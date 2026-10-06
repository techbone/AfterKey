/**
 * SPL token custody: deposit (lazy vault ATA), withdraw (auto-veto +
 * close-on-empty), and permissionless per-mint distribution with derived —
 * never caller-chosen — beneficiary ATAs (attack-tree.md G2.3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  SOL,
  createVault,
  expectError,
  fetchVault,
  newWorld,
  toInChallenge,
  toReleased,
  warp,
  type VaultCtx,
  type World,
} from "./helpers.ts";

const DECIMALS = 6;

async function createMint(w: World): Promise<PublicKey> {
  const mintKp = Keypair.generate();
  const rent = w.client.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: w.owner.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: MINT_SIZE,
      lamports: Number(rent),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mintKp.publicKey, DECIMALS, w.owner.publicKey, null),
  );
  await w.provider.sendAndConfirm!(tx, [mintKp]);
  return mintKp.publicKey;
}

async function fundAta(w: World, mint: PublicKey, wallet: PublicKey, amount: bigint) {
  const ata = getAssociatedTokenAddressSync(mint, wallet, true);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(w.owner.publicKey, ata, wallet, mint),
  );
  if (amount > 0n) {
    tx.add(createMintToInstruction(mint, ata, w.owner.publicKey, amount));
  }
  await w.provider.sendAndConfirm!(tx, []);
  return ata;
}

function tokenBalance(w: World, ata: PublicKey): bigint {
  const acc = w.client.getAccount(ata);
  if (!acc || acc.data.length !== ACCOUNT_SIZE) return -1n; // closed / missing
  return AccountLayout.decode(Uint8Array.from(acc.data)).amount;
}

function vaultAta(mint: PublicKey, v: VaultCtx): PublicKey {
  return getAssociatedTokenAddressSync(mint, v.vault, true);
}

test("token custody lifecycle", async (t) => {
  const w = await newWorld();
  const mint = await createMint(w);
  const ownerAta = await fundAta(w, mint, w.owner.publicKey, 10_000_000n);

  await t.test("deposit creates vault ATA and resets timer", async () => {
    const v = await createVault(w);
    const before = (await fetchVault(w, v)).lastCheckin;
    warp(w, 1000);
    await w.program.methods
      .depositToken(new BN(1_000_000))
      .accountsPartial({
        owner: w.owner.publicKey,
        vault: v.vault,
        mint,
        ownerTokenAccount: ownerAta,
        vaultTokenAccount: vaultAta(mint, v),
      })
      .rpc();
    assert.equal(tokenBalance(w, vaultAta(mint, v)), 1_000_000n);
    assert.ok((await fetchVault(w, v)).lastCheckin.gt(before));
  });

  await t.test("stranger cannot deposit into someone else's vault → NotOwner", async () => {
    const v = await createVault(w);
    const strangerAta = await fundAta(w, mint, w.stranger.publicKey, 1_000n);
    await expectError(
      w.program.methods
        .depositToken(new BN(1))
        .accountsPartial({
          owner: w.stranger.publicKey,
          vault: v.vault,
          mint,
          ownerTokenAccount: strangerAta,
          vaultTokenAccount: vaultAta(mint, v),
        })
        .signers([w.stranger])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("withdraw partial; withdraw-all closes the vault ATA", async () => {
    const v = await createVault(w);
    await w.program.methods
      .depositToken(new BN(500_000))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        ownerTokenAccount: ownerAta, vaultTokenAccount: vaultAta(mint, v),
      })
      .rpc();

    await w.program.methods
      .withdrawToken(new BN(200_000))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        vaultTokenAccount: vaultAta(mint, v), ownerTokenAccount: ownerAta,
      })
      .rpc();
    assert.equal(tokenBalance(w, vaultAta(mint, v)), 300_000n);

    await expectError(
      w.program.methods
        .withdrawToken(new BN(300_001))
        .accountsPartial({
          owner: w.owner.publicKey, vault: v.vault, mint,
          vaultTokenAccount: vaultAta(mint, v), ownerTokenAccount: ownerAta,
        })
        .rpc(),
      "InsufficientFunds",
    );

    warp(w, 1);
    await w.program.methods
      .withdrawToken(new BN(300_000))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        vaultTokenAccount: vaultAta(mint, v), ownerTokenAccount: ownerAta,
      })
      .rpc();
    assert.equal(tokenBalance(w, vaultAta(mint, v)), -1n, "vault ATA must be closed");
  });

  await t.test("withdraw during InChallenge auto-vetoes", async () => {
    const v = await createVault(w);
    await w.program.methods
      .depositToken(new BN(100_000))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        ownerTokenAccount: ownerAta, vaultTokenAccount: vaultAta(mint, v),
      })
      .rpc();
    await toInChallenge(w, v);
    await w.program.methods
      .withdrawToken(new BN(1))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        vaultTokenAccount: vaultAta(mint, v), ownerTokenAccount: ownerAta,
      })
      .rpc();
    const s = await fetchVault(w, v);
    assert.deepEqual(s.state, { active: {} });
    assert.equal(s.claimInitiatedAt.toNumber(), 0);
  });
});

test("token distribution", async (t) => {
  const w = await newWorld();
  const mint = await createMint(w);
  const ownerAta = await fundAta(w, mint, w.owner.publicKey, 10_000_000n);

  const deposit = (v: VaultCtx, amount: number) =>
    w.program.methods
      .depositToken(new BN(amount))
      .accountsPartial({
        owner: w.owner.publicKey, vault: v.vault, mint,
        ownerTokenAccount: ownerAta, vaultTokenAccount: vaultAta(mint, v),
      })
      .rpc();

  const distribute = (v: VaultCtx, recipients: PublicKey[], cranker = w.stranger) =>
    w.program.methods
      .distributeToken()
      .accountsPartial({
        cranker: cranker.publicKey, vault: v.vault, mint,
        vaultTokenAccount: vaultAta(mint, v),
      })
      .remainingAccounts(
        recipients.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })),
      )
      .signers([cranker])
      .rpc();

  // ATAs created once — balances accumulate across subtests, so assert deltas
  const heirAAta = await fundAta(w, mint, w.heirA.publicKey, 0n);
  const heirBAta = await fundAta(w, mint, w.heirB.publicKey, 0n);
  const strangerAta = await fundAta(w, mint, w.stranger.publicKey, 0n);

  await t.test("60/40 split exact with dust to last; vault ATA closed, rent to cranker", async () => {
    const v = await createVault(w);
    await deposit(v, 1_000_001); // odd total → floor + dust path
    await toReleased(w, v);

    const beforeA = tokenBalance(w, heirAAta);
    const beforeB = tokenBalance(w, heirBAta);
    const crankerBefore = w.client.getBalance(w.stranger.publicKey)!;

    await distribute(v, [heirAAta, heirBAta]);

    assert.equal(tokenBalance(w, heirAAta) - beforeA, 600_000n); // floor(1000001 × 0.6)
    assert.equal(tokenBalance(w, heirBAta) - beforeB, 400_001n); // remainder incl. dust
    assert.equal(tokenBalance(w, vaultAta(mint, v)), -1n, "vault ATA closed");
    assert.ok(
      w.client.getBalance(w.stranger.publicKey)! > crankerBefore,
      "cranker receives the closed ATA's rent",
    );
  });

  await t.test("wrong order / substituted / wallet-instead-of-ATA → NotBeneficiary", async () => {
    const v = await createVault(w);
    await deposit(v, 100_000);
    await toReleased(w, v);
    const beforeA = tokenBalance(w, heirAAta);

    await expectError(distribute(v, [heirBAta, heirAAta]), "NotBeneficiary");
    await expectError(distribute(v, [heirAAta, strangerAta]), "NotBeneficiary");
    await expectError(
      distribute(v, [w.heirA.publicKey, w.heirB.publicKey]), // wallets, not ATAs
      "NotBeneficiary",
    );
    await distribute(v, [heirAAta, heirBAta]); // correct order works
    assert.equal(tokenBalance(w, heirAAta) - beforeA, 60_000n);
  });

  await t.test("distribute in Active → WrongState", async () => {
    const v = await createVault(w);
    await deposit(v, 100_000);
    await expectError(distribute(v, [heirAAta, heirBAta]), "WrongState");
  });
});

test("closed vaults retain the correct token recovery authority", async (t) => {
  const w = await newWorld();
  const mint = await createMint(w);
  const ownerAta = await fundAta(w, mint, w.owner.publicKey, 10_000_000n);
  const heirAAta = await fundAta(w, mint, w.heirA.publicKey, 0n);
  const heirBAta = await fundAta(w, mint, w.heirB.publicKey, 0n);
  const deposit = (v: VaultCtx, amount: number) => w.program.methods.depositToken(new BN(amount))
    .accountsPartial({ owner: w.owner.publicKey, vault: v.vault, mint, ownerTokenAccount: ownerAta, vaultTokenAccount: vaultAta(mint, v) }).rpc();
  const withdraw = (v: VaultCtx, amount: number, signer = w.owner) => w.program.methods.withdrawToken(new BN(amount))
    .accountsPartial({ owner: signer.publicKey, vault: v.vault, mint, ownerTokenAccount: ownerAta, vaultTokenAccount: vaultAta(mint, v) })
    .signers(signer === w.owner ? [] : [signer]).rpc();
  const distribute = (v: VaultCtx) => w.program.methods.distributeToken()
    .accountsPartial({ cranker: w.owner.publicKey, vault: v.vault, mint, vaultTokenAccount: vaultAta(mint, v) })
    .remainingAccounts([heirAAta, heirBAta].map(pubkey => ({ pubkey, isWritable: true, isSigner: false }))).rpc();

  await t.test("owner cancellation cannot strand a funded ATA or enable beneficiary claims", async () => {
    const v = await createVault(w);
    await deposit(v, 100_000);
    await w.program.methods.closeVault().accountsPartial({ vault: v.vault }).rpc();
    assert.deepEqual((await fetchVault(w, v)).state, { closed: {} });
    await expectError(distribute(v), "WrongState");
    await expectError(w.program.methods.initiateClaim().accountsPartial({ claimer: w.heirA.publicKey, vault: v.vault }).signers([w.heirA]).rpc(), "WrongState");
    await withdraw(v, 100_000);
    assert.equal(tokenBalance(w, vaultAta(mint, v)), -1n);
    // External ATA transfers after cancellation remain recoverable too.
    await fundAta(w, mint, v.vault, 50_000n);
    warp(w, 1);
    await withdraw(v, 50_000);
    assert.equal(tokenBalance(w, vaultAta(mint, v)), -1n);
  });

  await t.test("released closure retains beneficiary rights and never returns them to the owner", async () => {
    const v = await createVault(w);
    await deposit(v, 100_001);
    await toReleased(w, v);
    await w.program.methods.closeReleasedVault().accountsPartial({ cranker: w.owner.publicKey, vault: v.vault }).rpc();
    await expectError(withdraw(v, 100_001), "WrongState");
    await expectError(w.program.methods.checkIn().accountsPartial({ vault: v.vault }).rpc(), "WrongState");
    await expectError(w.program.methods.vetoClaim().accountsPartial({ vault: v.vault }).rpc(), "WrongState");
    const beforeA = tokenBalance(w, heirAAta);
    const beforeB = tokenBalance(w, heirBAta);
    await distribute(v);
    assert.equal(tokenBalance(w, heirAAta) - beforeA, 60_000n);
    assert.equal(tokenBalance(w, heirBAta) - beforeB, 40_001n);
    // An untracked mint cannot be omitted to break authority recovery.
    const secondMint = await createMint(w);
    const secondA = await fundAta(w, secondMint, w.heirA.publicKey, 0n);
    const secondB = await fundAta(w, secondMint, w.heirB.publicKey, 0n);
    const secondVaultAta = await fundAta(w, secondMint, v.vault, 101n);
    await w.program.methods.distributeToken().accountsPartial({ cranker: w.owner.publicKey, vault: v.vault, mint: secondMint, vaultTokenAccount: secondVaultAta })
      .remainingAccounts([secondA, secondB].map(pubkey => ({ pubkey, isWritable: true, isSigner: false }))).rpc();
    assert.equal(tokenBalance(w, secondA), 60n);
    assert.equal(tokenBalance(w, secondB), 41n);
  });
});
