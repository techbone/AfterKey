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
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";

const ROOT = join(import.meta.dirname, "..");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  const idl = JSON.parse(readFileSync(join(ROOT, "packages/program/idl.json"), "utf8")) as Idl;
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"))),
  );
  const provider = new AnchorProvider(new Connection(RPC, "confirmed"), new Wallet(kp), {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);

  const sig = await program.methods.initializeConfig().rpc();
  console.log("config initialized:", sig);

  const [cfg] = await program.account.config.all();
  console.log("admin:         ", cfg.account.admin.toBase58());
  console.log("paused:        ", cfg.account.paused);
  console.log("min inactivity:", cfg.account.minInactivitySecs.toString(), "s");
  console.log("min challenge: ", cfg.account.minChallengeSecs.toString(), "s");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
