import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import type { ProofOfLife } from "../../../packages/program/proof_of_life.js";
import type { VaultSnapshot, VaultSource } from "./types.js";

const idl = JSON.parse(readFileSync(join(import.meta.dirname, "../../../packages/program/idl.json"), "utf8")) as ProofOfLife;
export const PROGRAM_ID = idl.address;
export class SolanaVaultSource implements VaultSource {
  private connection: Connection;
  private program: Program<ProofOfLife>;
  constructor(url: string) {
    this.connection = new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true });
    const wallet = { publicKey: PublicKey.default,
      signTransaction: async <T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> => { throw new Error("The notification service cannot sign vault transactions."); },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> => { throw new Error("The notification service cannot sign vault transactions."); } };
    this.program = new Program<ProofOfLife>(idl, new AnchorProvider(this.connection, wallet, { commitment: "confirmed" }));
  }
  async ready() {
    if (await this.connection.getGenesisHash() !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") throw new Error("This prepared notification service supports Solana devnet only.");
    const account = await this.connection.getAccountInfo(this.program.programId);
    if (!account?.executable) throw new Error("The configured devnet program is not executable.");
  }
  private map(address: string, value: Awaited<ReturnType<typeof this.program.account.vault.fetch>>): VaultSnapshot {
    const state = Object.keys(value.state)[0] as VaultSnapshot["state"];
    if (!["active", "inChallenge", "released", "closed"].includes(state)) throw new Error("Unsupported vault state.");
    return { address, owner: value.owner.toBase58(), state, lastCheckin: value.lastCheckin.toNumber(),
      inactivitySeconds: value.inactivityPeriod.toNumber(), claimInitiatedAt: value.claimInitiatedAt.toNumber(), challengeSeconds: value.challengePeriod.toNumber() };
  }
  async list() { return (await this.program.account.vault.all()).map(v => this.map(v.publicKey.toBase58(), v.account)); }
  async get(address: string) { const key = new PublicKey(address); const value = await this.program.account.vault.fetchNullable(key); return value ? this.map(address, value) : null; }
}
