/** Post-deploy sanity check: config present + instruction set current. */
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
  const program = new Program(idl, new AnchorProvider(new Connection(RPC, "confirmed"), new Wallet(kp), {}));

  const cfg = await program.account.config.all();
  console.log("config present:  ", cfg.length === 1);
  if (cfg[0]) {
    console.log("min inactivity:  ", cfg[0].account.minInactivitySecs.toString() + "s");
    console.log("min challenge:   ", cfg[0].account.minChallengeSecs.toString() + "s");
    console.log("paused:          ", cfg[0].account.paused);
  }
  console.log("instructions:    ", idl.instructions.length);
  // IDL stores snake_case; the JS client camelCases it (closeReleasedVault()).
  console.log(
    "close_released_vault:",
    idl.instructions.some((x) => x.name === "close_released_vault"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
