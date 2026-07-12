/**
 * Live devnet demo: the entire inheritance lifecycle in ~3 minutes against
 * the devnet-timing build (60s inactivity / 30s challenge minimums).
 *
 *   npx tsx scripts/demo-lifecycle.ts
 *
 * Uses ~/.config/solana/id.json as the vault owner. Prints explorer links
 * for every transaction. This script doubles as the public "claim without
 * the company" runbook (docs/repo-blueprint.md — packages/cli grows from it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  type Idl,
} from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const ROOT = join(import.meta.dirname, "..");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const INACTIVITY = 60; // seconds — devnet-timing build minimums
const CHALLENGE = 30;
const DEPOSIT = 0.1 * LAMPORTS_PER_SOL;

const link = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const log = (msg: string) => console.log(`\n▸ ${msg}`);
const sol = (lamports: number | bigint) => `${Number(lamports) / LAMPORTS_PER_SOL} SOL`;

async function countdown(label: string, secs: number) {
  process.stdout.write(`\n⏳ ${label}: ${secs}s`);
  for (let i = secs; i > 0; i--) {
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write(`\r⏳ ${label}: ${i - 1}s   `);
  }
  console.log();
}

async function main() {
  const idl = JSON.parse(readFileSync(join(ROOT, "packages/program/idl.json"), "utf8")) as Idl;
  const ownerKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"))),
  );
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(ownerKp), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  const programId = new PublicKey(idl.address);

  const heirA = Keypair.generate(); // spouse — 60%
  const heirB = Keypair.generate(); // child — 40%

  console.log("═══ Proof of Life — live devnet demo ═══");
  console.log(`program:  ${programId.toBase58()}`);
  console.log(`owner:    ${ownerKp.publicKey.toBase58()}`);
  console.log(`heir A:   ${heirA.publicKey.toBase58()} (60%)`);
  console.log(`heir B:   ${heirB.publicKey.toBase58()} (40%)`);

  const vaultId = new BN(Date.now()); // unique per run
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerKp.publicKey.toBuffer(), vaultId.toArrayLike(Buffer, "le", 8)],
    programId,
  );
  const [solEscrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_escrow"), vault.toBuffer()],
    programId,
  );

  log(`Creating vault ${vault.toBase58()} — "if I'm silent for ${INACTIVITY}s, my heirs may claim; they must then survive a ${CHALLENGE}s challenge window"`);
  let sig = await program.methods
    .initializeVault(vaultId, new BN(INACTIVITY), new BN(CHALLENGE), [
      { key: heirA.publicKey, shareBps: 6000 },
      { key: heirB.publicKey, shareBps: 4000 },
    ])
    .accounts({ owner: ownerKp.publicKey })
    .rpc();
  console.log(`  ${link(sig)}`);

  log(`Depositing ${sol(DEPOSIT)}`);
  sig = await program.methods.depositSol(new BN(DEPOSIT)).accounts({ vault }).rpc();
  console.log(`  ${link(sig)}`);

  log("Heir A tries to claim immediately — the protocol must refuse (owner is alive)");
  try {
    await program.methods
      .initiateClaim()
      .accounts({ claimer: heirA.publicKey, vault })
      .signers([heirA])
      .rpc();
    throw new Error("BUG: early claim succeeded");
  } catch (e) {
    console.log(`  ✓ rejected: InactivityPeriodNotElapsed`);
  }

  log("Owner checks in (proof of life) — timer resets");
  sig = await program.methods.checkIn().accounts({ vault }).rpc();
  console.log(`  ${link(sig)}`);

  await countdown("Owner goes silent (inactivity period)", INACTIVITY + 5);

  log("Heir A initiates a claim — challenge window opens");
  sig = await program.methods
    .initiateClaim()
    .accounts({ claimer: heirA.publicKey, vault })
    .signers([heirA])
    .rpc();
  console.log(`  ${link(sig)}`);

  log("Plot twist: the owner is alive and vetoes with ONE signature");
  sig = await program.methods.vetoClaim().accounts({ vault }).rpc();
  console.log(`  ${link(sig)}`);

  await countdown("This time the owner is really gone", INACTIVITY + 5);

  log("Heir B initiates the claim");
  sig = await program.methods
    .initiateClaim()
    .accounts({ claimer: heirB.publicKey, vault })
    .signers([heirB])
    .rpc();
  console.log(`  ${link(sig)}`);

  await countdown("Challenge window — no veto comes", CHALLENGE + 5);

  log("ANYONE can finalize (here: heir A cranks it — the company isn't needed)");
  sig = await program.methods
    .finalizeClaim()
    .accounts({ cranker: heirA.publicKey, vault })
    .signers([heirA])
    .rpc();
  console.log(`  ${link(sig)}`);

  log("Distributing per shares");
  sig = await program.methods
    .distributeSol()
    .accounts({ cranker: ownerKp.publicKey, vault })
    .remainingAccounts([
      { pubkey: heirA.publicKey, isSigner: false, isWritable: true },
      { pubkey: heirB.publicKey, isSigner: false, isWritable: true },
    ])
    .rpc();
  console.log(`  ${link(sig)}`);

  const balA = await connection.getBalance(heirA.publicKey);
  const balB = await connection.getBalance(heirB.publicKey);
  console.log("\n═══ Inheritance complete ═══");
  console.log(`heir A received: ${sol(balA)} (expected 60% = ${sol(DEPOSIT * 0.6)})`);
  console.log(`heir B received: ${sol(balB)} (expected 40% = ${sol(DEPOSIT * 0.4)})`);
  console.log(`vault:  https://explorer.solana.com/address/${vault.toBase58()}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
