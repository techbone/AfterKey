/** Read-only deployment sanity check. No wallet secrets or transactions. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { ProofOfLife } from "../packages/program/proof_of_life.js";

const ROOT = join(import.meta.dirname, "..");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  const idl = JSON.parse(readFileSync(join(ROOT, "packages/program/idl.json"), "utf8")) as ProofOfLife;
  const connection = new Connection(RPC, "confirmed");
  const program = new Program<ProofOfLife>(idl, new AnchorProvider(connection, new Wallet(Keypair.generate()), {}));
  const programAccount = await connection.getAccountInfo(program.programId);
  if (!programAccount?.executable) throw new Error("Program is missing or not executable.");
  const [configAddress] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const config = await program.account.config.fetch(configAddress);
  console.log("program executable:", true);
  console.log("config:", configAddress.toBase58());
  console.log("minimum inactivity:", config.minInactivitySecs.toString() + "s");
  console.log("minimum challenge:", config.minChallengeSecs.toString() + "s");
  console.log("paused:", config.paused);
  if (config.paused) throw new Error("Program is paused for new vaults and deposits.");

  const localArtifact = process.env.SOLANA_PROGRAM_PATH ?? join(ROOT, "target/deploy/proof_of_life.so");
  if (!existsSync(localArtifact)) {
    console.log("Source/artifact parity unverified: build the program and rerun this check.");
    return;
  }
  // Upgradeable loader Program data: 4-byte tag + ProgramData pubkey.
  const dataAddress = new PublicKey(programAccount.data.subarray(4, 36));
  const programData = await connection.getAccountInfo(dataAddress);
  if (!programData) throw new Error("ProgramData account is missing.");
  // ProgramData metadata occupies 45 bytes; deployed programs may have padding.
  const local = readFileSync(localArtifact);
  const deployed = programData.data.subarray(45);
  const matches = deployed.length >= local.length && local.equals(deployed.subarray(0, local.length))
    && deployed.subarray(local.length).every(byte => byte === 0);
  console.log("deployed bytecode matches local artifact:", matches);
  if (!matches) throw new Error("The deployment differs from the local build. Deploy the reviewed artifact before marking this release ready.");
}

main().catch(e => { console.error(e); process.exitCode = 1; });
