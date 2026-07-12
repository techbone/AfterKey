/**
 * Full-lifecycle smoke test on LiteSVM with clock warping:
 * config → vault → deposit → check-in → claim (early = fail) → claim →
 * veto → claim again → finalize (early = fail) → finalize → distribute →
 * shares verified. This is the Milestone 1 "time-based assertions are
 * testable" spike; the exhaustive matrix (docs/smart-contracts.md §10)
 * builds on this harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";

const ROOT = join(import.meta.dirname, "..");
const IDL = JSON.parse(readFileSync(join(ROOT, "target/idl/proof_of_life.json"), "utf8"));

const DAY = 86_400;
const INACTIVITY = new BN(180 * DAY); // 6 months
const CHALLENGE = new BN(30 * DAY); // 30 days

function expectError(p: Promise<unknown>, code: string): Promise<void> {
  return p.then(
    () => assert.fail(`expected ${code}, but transaction succeeded`),
    (e: unknown) => {
      const msg = e instanceof Error ? `${e.message}\n${JSON.stringify(e)}` : String(e);
      assert.ok(msg.includes(code), `expected ${code} in error, got: ${msg.slice(0, 400)}`);
    },
  );
}

test("full inheritance lifecycle", async () => {
  const client = fromWorkspace(ROOT);
  const provider = new LiteSVMProvider(client);
  const program = new Program(IDL, provider);
  const programId = new PublicKey(IDL.address);

  const owner = provider.wallet.payer;
  client.airdrop(owner.publicKey, BigInt(100 * LAMPORTS_PER_SOL));
  const heirA = Keypair.generate();
  const heirB = Keypair.generate();
  const stranger = Keypair.generate();
  for (const kp of [heirA, heirB, stranger]) {
    client.airdrop(kp.publicKey, BigInt(LAMPORTS_PER_SOL));
  }

  const vaultId = new BN(1);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.publicKey.toBuffer(), vaultId.toArrayLike(Buffer, "le", 8)],
    programId,
  );
  const [solEscrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_escrow"), vault.toBuffer()],
    programId,
  );

  const warp = (secs: number) => {
    const clock = client.getClock();
    clock.unixTimestamp = clock.unixTimestamp + BigInt(secs);
    client.setClock(clock);
    // LiteSVM's blockhash is static; expire it so repeated byte-identical
    // transactions don't dedupe as AlreadyProcessed.
    client.expireBlockhash();
  };
  const vaultState = () => program.account.vault.fetch(vault);

  // --- setup: config + vault (60/40 split) + deposit 10 SOL ---
  await program.methods.initializeConfig().rpc();

  const beneficiaries = [
    { key: heirA.publicKey, shareBps: 6000 },
    { key: heirB.publicKey, shareBps: 4000 },
  ];
  await program.methods
    .initializeVault(vaultId, INACTIVITY, CHALLENGE, beneficiaries)
    .accounts({ owner: owner.publicKey })
    .rpc();

  let v = await vaultState();
  assert.deepEqual(v.state, { active: {} });
  assert.equal(v.beneficiaries.length, 2);

  const DEPOSIT = new BN(10 * LAMPORTS_PER_SOL);
  await program.methods.depositSol(DEPOSIT).accounts({ vault }).rpc();
  assert.equal(client.getBalance(solEscrow), BigInt(DEPOSIT.toString()));

  // --- invalid beneficiary configs are rejected ---
  await expectError(
    program.methods
      .initializeVault(new BN(2), INACTIVITY, CHALLENGE, [
        { key: heirA.publicKey, shareBps: 5000 },
        { key: heirB.publicKey, shareBps: 4000 },
      ])
      .accounts({ owner: owner.publicKey })
      .rpc(),
    "SharesMustSum10000",
  );

  // --- liveness: claims fail while owner is active ---
  await expectError(
    program.methods
      .initiateClaim()
      .accounts({ claimer: heirA.publicKey, vault })
      .signers([heirA])
      .rpc(),
    "InactivityPeriodNotElapsed",
  );

  // stranger (not a beneficiary) can never claim, even after silence
  warp(INACTIVITY.toNumber() + DAY);
  await expectError(
    program.methods
      .initiateClaim()
      .accounts({ claimer: stranger.publicKey, vault })
      .signers([stranger])
      .rpc(),
    "NotBeneficiary",
  );

  // check-in resets the timer → heir can't claim anymore
  await program.methods.checkIn().accounts({ vault }).rpc();
  await expectError(
    program.methods
      .initiateClaim()
      .accounts({ claimer: heirA.publicKey, vault })
      .signers([heirA])
      .rpc(),
    "InactivityPeriodNotElapsed",
  );

  // --- owner goes silent; heir claims; owner vetoes ---
  warp(INACTIVITY.toNumber() + DAY);
  await program.methods
    .initiateClaim()
    .accounts({ claimer: heirA.publicKey, vault })
    .signers([heirA])
    .rpc();
  v = await vaultState();
  assert.deepEqual(v.state, { inChallenge: {} });

  await program.methods.vetoClaim().accounts({ vault }).rpc();
  v = await vaultState();
  assert.deepEqual(v.state, { active: {} });
  assert.equal(v.claimer.toBase58(), PublicKey.default.toBase58());

  // --- owner goes silent for good ---
  warp(INACTIVITY.toNumber() + DAY);
  await program.methods
    .initiateClaim()
    .accounts({ claimer: heirB.publicKey, vault })
    .signers([heirB])
    .rpc();

  // finalize before the challenge window ends must fail
  await expectError(
    program.methods
      .finalizeClaim()
      .accounts({ cranker: stranger.publicKey, vault })
      .signers([stranger])
      .rpc(),
    "ChallengeNotElapsed",
  );

  // ... and succeeds after it (permissionless: a stranger cranks it)
  warp(CHALLENGE.toNumber() + 1);
  await program.methods
    .finalizeClaim()
    .accounts({ cranker: stranger.publicKey, vault })
    .signers([stranger])
    .rpc();
  v = await vaultState();
  assert.deepEqual(v.state, { released: {} });

  // --- distribution: 60/40, exact to the lamport, cranked by a stranger ---
  const balA = client.getBalance(heirA.publicKey)!;
  const balB = client.getBalance(heirB.publicKey)!;
  await program.methods
    .distributeSol()
    .accounts({ cranker: stranger.publicKey, vault })
    .remainingAccounts([
      { pubkey: heirA.publicKey, isSigner: false, isWritable: true },
      { pubkey: heirB.publicKey, isSigner: false, isWritable: true },
    ])
    .signers([stranger])
    .rpc();

  const total = BigInt(DEPOSIT.toString());
  assert.equal(client.getBalance(heirA.publicKey)! - balA, (total * 6000n) / 10000n);
  assert.equal(client.getBalance(heirB.publicKey)! - balB, (total * 4000n) / 10000n);
  assert.equal(client.getBalance(solEscrow) ?? 0n, 0n); // drained account may be GC'd

  // owner can no longer touch a released vault
  await expectError(
    program.methods.checkIn().accounts({ vault }).rpc(),
    "WrongState",
  );
});
