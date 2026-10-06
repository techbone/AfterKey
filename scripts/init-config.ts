import type { ProofOfLife } from "../packages/program/proof_of_life.js";
/**
 * One-time per cluster: initialize the Config PDA right after deploy.
 * The signer becomes admin — on mainnet this MUST be executed by the Squads
 * multisig in the same ceremony as the deploy (docs/repo-blueprint.md §3).
 *
 *   npx tsx scripts/init-config.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const ROOT = join(import.meta.dirname, "..");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  const idl = JSON.parse(readFileSync(join(ROOT, "packages/program/idl.json"), "utf8")) as ProofOfLife;
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET ?? join(homedir(), ".config/solana/id.json"), "utf8"))),
  );
  const provider = new AnchorProvider(new Connection(RPC, "confirmed"), new Wallet(kp), {
    commitment: "confirmed",
  });
  const program = new Program<ProofOfLife>(idl, provider);

  const sig = await program.methods.initializeConfig().rpc();
  console.log("config initialized:", sig);

  const [address] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const cfg = await program.account.config.fetch(address);
  console.log("admin:         ", cfg.admin.toBase58());
  console.log("paused:        ", cfg.paused);
  console.log("min inactivity:", cfg.minInactivitySecs.toString(), "s");
  console.log("min challenge: ", cfg.minChallengeSecs.toString(), "s");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
