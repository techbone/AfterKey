import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../../../../packages/program/idl.json";

export const IDL = idl;
export const PROGRAM_ID = new PublicKey(idl.address);
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddr = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;

// Uint8Array (not Buffer) — this module runs in the browser.
const seed = (s: string) => new TextEncoder().encode(s);

export function vaultPda(owner: PublicKey, vaultId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [seed("vault"), owner.toBytes(), Uint8Array.from(vaultId.toArray("le", 8))],
    PROGRAM_ID,
  )[0];
}

export function escrowPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([seed("sol_escrow"), vault.toBytes()], PROGRAM_ID)[0];
}

export function shortKey(k: PublicKey | string, chars = 4): string {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

// Devnet build minimums (60s/30s) let testers demo in minutes; the UI offers
// human presets too. Mainnet build enforces 30d/7d minimums on-chain.
export const INACTIVITY_PRESETS = [
  { label: "2 minutes (demo)", seconds: 120 },
  { label: "6 months", seconds: 180 * 86_400 },
  { label: "1 year", seconds: 365 * 86_400 },
  { label: "2 years", seconds: 730 * 86_400 },
] as const;

export const CHALLENGE_PRESETS = [
  { label: "1 minute (demo)", seconds: 60 },
  { label: "30 days", seconds: 30 * 86_400 },
  { label: "60 days", seconds: 60 * 86_400 },
] as const;
