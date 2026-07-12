/**
 * Shared LiteSVM test harness. Each test file creates one World; each test
 * case creates a fresh vault (unique vault_id) so state never leaks between
 * cases. Clock warps are global to the World — vaults created later simply
 * start with a later last_checkin, which is fine.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import type { LiteSVM } from "litesvm";

export const ROOT = join(import.meta.dirname, "..");
export const IDL = JSON.parse(
  readFileSync(join(ROOT, "target/idl/proof_of_life.json"), "utf8"),
);

export const DAY = 86_400;
export const INACTIVITY = new BN(180 * DAY); // 6 months
export const CHALLENGE = new BN(30 * DAY); // 30 days
export const SOL = LAMPORTS_PER_SOL;

export interface World {
  client: LiteSVM;
  provider: LiteSVMProvider;
  program: Program;
  programId: PublicKey;
  /** provider wallet — also the config admin */
  owner: Keypair;
  heirA: Keypair;
  heirB: Keypair;
  stranger: Keypair;
  nextVaultId: number;
}

export interface VaultCtx {
  vaultId: BN;
  vault: PublicKey;
  solEscrow: PublicKey;
}

export async function newWorld(): Promise<World> {
  const client = fromWorkspace(ROOT);
  const provider = new LiteSVMProvider(client);
  const program = new Program(IDL, provider);
  const programId = new PublicKey(IDL.address);
  const owner = provider.wallet.payer;
  const heirA = Keypair.generate();
  const heirB = Keypair.generate();
  const stranger = Keypair.generate();
  client.airdrop(owner.publicKey, BigInt(1_000 * SOL));
  for (const kp of [heirA, heirB, stranger]) {
    client.airdrop(kp.publicKey, BigInt(10 * SOL));
  }
  await program.methods.initializeConfig().rpc();
  return { client, provider, program, programId, owner, heirA, heirB, stranger, nextVaultId: 1 };
}

export function pdas(w: World, vaultId: BN, owner?: PublicKey): VaultCtx {
  const [vault] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      (owner ?? w.owner.publicKey).toBuffer(),
      vaultId.toArrayLike(Buffer, "le", 8),
    ],
    w.programId,
  );
  const [solEscrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_escrow"), vault.toBuffer()],
    w.programId,
  );
  return { vaultId, vault, solEscrow };
}

export function defaultBeneficiaries(w: World) {
  return [
    { key: w.heirA.publicKey, shareBps: 6000 },
    { key: w.heirB.publicKey, shareBps: 4000 },
  ];
}

export async function createVault(
  w: World,
  opts: {
    beneficiaries?: { key: PublicKey; shareBps: number }[];
    depositSol?: BN;
    inactivity?: BN;
    challenge?: BN;
  } = {},
): Promise<VaultCtx> {
  const vaultId = new BN(w.nextVaultId++);
  const ctx = pdas(w, vaultId);
  await w.program.methods
    .initializeVault(
      vaultId,
      opts.inactivity ?? INACTIVITY,
      opts.challenge ?? CHALLENGE,
      opts.beneficiaries ?? defaultBeneficiaries(w),
    )
    .accounts({ owner: w.owner.publicKey })
    .rpc();
  if (opts.depositSol && !opts.depositSol.isZero()) {
    await w.program.methods.depositSol(opts.depositSol).accounts({ vault: ctx.vault }).rpc();
  }
  return ctx;
}

export function warp(w: World, secs: number | bigint) {
  const clock = w.client.getClock();
  clock.unixTimestamp = clock.unixTimestamp + BigInt(secs);
  w.client.setClock(clock);
  // LiteSVM's blockhash is static; expire it so byte-identical transactions
  // don't dedupe as AlreadyProcessed.
  w.client.expireBlockhash();
}

export function warpTo(w: World, unixTs: bigint) {
  const clock = w.client.getClock();
  clock.unixTimestamp = unixTs;
  w.client.setClock(clock);
  w.client.expireBlockhash();
}

/** Drive a fresh Active vault into InChallenge (heirA is the claimer). */
export async function toInChallenge(w: World, v: VaultCtx) {
  warp(w, INACTIVITY.toNumber() + 2);
  await w.program.methods
    .initiateClaim()
    .accounts({ claimer: w.heirA.publicKey, vault: v.vault })
    .signers([w.heirA])
    .rpc();
}

/** Drive a fresh Active vault into Released (stranger cranks finalize). */
export async function toReleased(w: World, v: VaultCtx) {
  await toInChallenge(w, v);
  warp(w, CHALLENGE.toNumber() + 2);
  await w.program.methods
    .finalizeClaim()
    .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
    .signers([w.stranger])
    .rpc();
}

export function fetchVault(w: World, v: VaultCtx) {
  return w.program.account.vault.fetch(v.vault);
}

/** Assert the promise rejects and the error mentions the exact PolError code. */
export function expectError(p: Promise<unknown>, code: string): Promise<void> {
  return p.then(
    () => assert.fail(`expected ${code}, but transaction succeeded`),
    (e: unknown) => {
      const msg = e instanceof Error ? `${e.message}\n${JSON.stringify(e)}` : String(e);
      assert.ok(msg.includes(code), `expected ${code} in error, got: ${msg.slice(0, 400)}`);
    },
  );
}
