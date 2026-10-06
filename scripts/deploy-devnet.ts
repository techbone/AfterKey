/** Devnet-only deployment using the encrypted key backup and macOS Keychain. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { ProofOfLife } from "../packages/program/proof_of_life.js";
import { withDeploymentKeys } from "./devnet-keystore.ts";

const ROOT = join(import.meta.dirname, "..");
const RPC = "https://api.devnet.solana.com";
const connection = new Connection(RPC, { commitment: "confirmed", disableRetryOnRateLimit: true });

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Solana CLI exited with code ${code}. Encrypted buffer keys remain available for recovery/resume.`)));
  });
}

async function main() {
  const [command, backup, extra] = process.argv.slice(2);
  if (!backup || !["fund", "deploy"].includes(command)) throw new Error("Usage: npm run deploy:devnet -- fund <encrypted-backup> [SOL, max 5] | deploy <encrypted-backup> [program.so]");
  if (command === "fund") {
    const envelope = JSON.parse(readFileSync(backup, "utf8"));
    if (envelope.version !== 1 || envelope.cluster !== "devnet") throw new Error("Unsupported key backup.");
    const address = new PublicKey(envelope.addresses.authority);
    const amount = Number(extra ?? "5");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5) throw new Error("Request between 0 and 5 devnet SOL.");
    const signature = await connection.requestAirdrop(address, Math.round(amount * LAMPORTS_PER_SOL));
    const latest = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    if (confirmation.value.err) throw new Error("Devnet airdrop failed to confirm.");
    console.log("airdrop transaction:", signature);
    console.log("authority:", address.toBase58());
    console.log("devnet SOL:", (await connection.getBalance(address)) / LAMPORTS_PER_SOL);
    return;
  }

  const binary = resolve(extra ?? join(ROOT, "target/deploy/proof_of_life.so"));
  const bytes = readFileSync(binary);
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) throw new Error("Expected an SBF ELF binary.");
  const artifactSha256 = createHash("sha256").update(bytes).digest("hex");
  const idl = JSON.parse(readFileSync(join(ROOT, "packages/program/idl.json"), "utf8")) as ProofOfLife;

  await withDeploymentKeys(backup, async (paths, addresses) => {
    if (idl.address !== addresses.program) throw new Error("Encrypted program key does not match the committed IDL. Build the intended program address first.");
    const authority = new PublicKey(addresses.authority);
    const programId = new PublicKey(addresses.program);
    const existing = await connection.getAccountInfo(programId);
    if (existing) {
      if (!existing.executable || existing.owner.toBase58() !== "BPFLoaderUpgradeab1e11111111111111111111111") throw new Error("Unexpected existing program account.");
      const data = await connection.getAccountInfo(new PublicKey(existing.data.subarray(4, 36)));
      if (!data || data.data[12] !== 1 || !new PublicKey(data.data.subarray(13, 45)).equals(authority)) throw new Error("Signing wallet is not the existing upgrade authority.");
    }
    // Buffer rent is recycled into ProgramData during the final deployment.
    const minimum = (existing ? 0 : await connection.getMinimumBalanceForRentExemption(36))
      + await connection.getMinimumBalanceForRentExemption(bytes.length + 45) + 50_000_000;
    const balance = await connection.getBalance(authority);
    if (balance < minimum) throw new Error(`Fund authority ${addresses.authority} with at least ${(minimum / LAMPORTS_PER_SOL).toFixed(3)} devnet SOL (current ${(balance / LAMPORTS_PER_SOL).toFixed(3)}).`);
    console.log("deploying devnet program:", addresses.program);
    console.log("artifact SHA256:", artifactSha256);
    await run(process.env.SOLANA_CLI ?? "solana", [
      "program", "deploy", binary, "--url", "devnet", "--keypair", paths.authority,
      "--upgrade-authority", paths.authority, "--program-id", existing ? addresses.program : paths.program,
      "--buffer", paths.buffer, "--max-len", String(bytes.length), "--use-rpc", "--commitment", "confirmed"
    ]);

    const signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(paths.authority, "utf8"))));
    try {
      const program = new Program<ProofOfLife>(idl, new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" }));
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
      let configSignature: string | null = null;
      if (!(await connection.getAccountInfo(config))) configSignature = await program.methods.initializeConfig().rpc();
      const settings = await program.account.config.fetch(config);
      if (!settings.admin.equals(authority) || settings.paused || settings.minInactivitySecs.toNumber() !== 60 || settings.minChallengeSecs.toNumber() !== 30) throw new Error("Deployment config does not match the intended authority and devnet timing. Do not publish the frontend.");
      const account = await connection.getAccountInfo(programId);
      if (!account?.executable) throw new Error("Deployment is not executable.");
      const dataAddress = new PublicKey(account.data.subarray(4, 36));
      const data = await connection.getAccountInfo(dataAddress);
      if (!data || data.data[12] !== 1 || !new PublicKey(data.data.subarray(13, 45)).equals(authority)) throw new Error("Deployed upgrade authority differs from signer.");
      const deployed = data.data.subarray(45);
      if (deployed.length < bytes.length || !bytes.equals(deployed.subarray(0, bytes.length)) || !deployed.subarray(bytes.length).every(byte => byte === 0)) throw new Error("Deployed bytecode does not match the reviewed artifact.");
      const receipt = {
        cluster: "devnet", programId: addresses.program, programData: dataAddress.toBase58(), upgradeAuthority: addresses.authority,
        slot: Number(data.data.readBigUInt64LE(4)), artifactSha256, artifactBytes: bytes.length,
        config: config.toBase58(), configSignature, minInactivitySeconds: 60, minChallengeSeconds: 30,
        bytecodeMatches: true, verifiedAt: new Date().toISOString()
      };
      writeFileSync(join(ROOT, "docs/devnet-deployment.json"), JSON.stringify(receipt, null, 2) + "\n");
      console.log(JSON.stringify(receipt, null, 2));
    } finally { signer.secretKey.fill(0); }
  });
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Devnet deployment failed."); process.exitCode = 1; });
