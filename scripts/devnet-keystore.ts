/** Encrypted devnet deployment keys. Never prints private keys or passwords. */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Keypair } from "@solana/web3.js";

const keychainHelper = join(import.meta.dirname, "devnet-keychain.swift");
const kdf = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
type Roles = "authority" | "program" | "buffer";
type Addresses = Record<Roles, string>;
type SecretKeys = Record<Roles, number[]>;
type Envelope = {
  version: 1; cluster: "devnet"; addresses: Addresses;
  salt: string; nonce: string; ciphertext: string; tag: string;
};
const roles: Roles[] = ["authority", "program", "buffer"];

function aad(e: Omit<Envelope, "ciphertext" | "tag">) {
  return Buffer.from(JSON.stringify({ version: e.version, cluster: e.cluster, addresses: e.addresses, salt: e.salt, nonce: e.nonce }));
}

export function encryptKeys(keys: SecretKeys, password: string): Envelope {
  if (password.length < 12) throw new Error("Use a backup password of at least 12 characters.");
  const addresses = Object.fromEntries(roles.map(role => [role, Keypair.fromSecretKey(Uint8Array.from(keys[role])).publicKey.toBase58()])) as Addresses;
  const header = { version: 1 as const, cluster: "devnet" as const, addresses, salt: randomBytes(16).toString("base64"), nonce: randomBytes(12).toString("base64") };
  const key = scryptSync(password, Buffer.from(header.salt, "base64"), 32, kdf);
  const cipher = createCipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
  cipher.setAAD(aad(header));
  const plaintext = Buffer.from(JSON.stringify(keys));
  try {
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]).toString("base64");
    return { ...header, ciphertext, tag: cipher.getAuthTag().toString("base64") };
  } finally { key.fill(0); plaintext.fill(0); }
}

export function decryptKeys(envelope: Envelope, password: string): SecretKeys {
  if (envelope.version !== 1 || envelope.cluster !== "devnet") throw new Error("Unsupported key backup.");
  const key = scryptSync(password, Buffer.from(envelope.salt, "base64"), 32, kdf);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
  decipher.setAAD(aad(envelope));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  let plaintext: Buffer | undefined;
  try {
    plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    const keys = JSON.parse(plaintext.toString()) as SecretKeys;
    for (const role of roles) {
      if (Keypair.fromSecretKey(Uint8Array.from(keys[role])).publicKey.toBase58() !== envelope.addresses[role]) throw new Error("Backup address mismatch.");
    }
    return keys;
  } finally { key.fill(0); plaintext?.fill(0); }
}

function passwordDialog(message: string): string {
  const script = `text returned of (display dialog ${JSON.stringify(message)} default answer "" with hidden answer with title "AfterKey devnet keys" buttons {"Cancel", "Continue"} default button "Continue")`;
  const result = spawnSync("/usr/bin/osascript", ["-e", script], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Password dialog was cancelled or unavailable. No password was logged.");
  return result.stdout.replace(/\r?\n$/, "");
}

function keychain(mode: "add" | "read", envelope: Envelope, password?: string): string {
  const request = { service: `com.afterkey.devnet.${envelope.addresses.program}`, account: envelope.addresses.authority, ...(password === undefined ? {} : { password }) };
  const result = spawnSync("/usr/bin/swift", [keychainHelper, mode], {
    input: JSON.stringify(request), encoding: "utf8", maxBuffer: 1024 * 1024,
    env: { ...process.env, CLANG_MODULE_CACHE_PATH: "/private/tmp/afterkey-swift-cache" }
  });
  if (result.status !== 0) throw new Error("macOS Keychain access failed. The encrypted backup can still be unlocked with its password.");
  return result.stdout;
}

export async function withDeploymentKeys<T>(file: string, action: (paths: Record<Roles, string>, addresses: Addresses) => Promise<T>): Promise<T> {
  const envelope = JSON.parse(readFileSync(file, "utf8")) as Envelope;
  let password: string;
  try { password = keychain("read", envelope); }
  catch { password = passwordDialog("Enter your encrypted AfterKey devnet backup password."); }
  const keys = decryptKeys(envelope, password);
  const directory = mkdtempSync(join(tmpdir(), "afterkey-signers-"));
  chmodSync(directory, 0o700);
  const cleanup = () => { for (const role of roles) keys[role].fill(0); rmSync(directory, { recursive: true, force: true }); };
  const interrupted = () => { cleanup(); process.exit(130); };
  process.once("exit", cleanup);
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    const paths = Object.fromEntries(roles.map(role => {
      const path = join(directory, `${role}-keypair.json`);
      writeFileSync(path, JSON.stringify(keys[role]), { mode: 0o600, flag: "wx" });
      keys[role].fill(0);
      return [role, path];
    })) as Record<Roles, string>;
    return await action(paths, envelope.addresses);
  } finally {
    cleanup();
    process.removeListener("exit", cleanup);
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
  }
}

async function main() {
  if (process.argv[2] === "restore" && process.argv[3]) {
    const envelope = JSON.parse(readFileSync(process.argv[3], "utf8")) as Envelope;
    const password = passwordDialog("Enter your encrypted AfterKey backup password to restore this devnet signer in macOS Keychain.");
    const keys = decryptKeys(envelope, password);
    for (const role of roles) keys[role].fill(0);
    keychain("add", envelope, password);
    console.log(JSON.stringify({ addresses: envelope.addresses, passwordSavedInKeychain: true }, null, 2));
    return;
  }
  if (process.argv[2] !== "create") throw new Error("Usage: node --import tsx scripts/devnet-keystore.ts create | restore <encrypted-backup>");
  let password = passwordDialog("Choose a strong backup password (12+ characters). Keep it separately and copy the encrypted key backup off this Mac. This password is never sent to chat.");
  while (password.length < 12) password = passwordDialog("That password was shorter than 12 characters. Use a longer password or passphrase, and keep it separately from the encrypted backup. No keys have been created yet.");
  if (passwordDialog("Confirm your backup password.") !== password) throw new Error("Passwords did not match. No keys created.");
  const keys = Object.fromEntries(roles.map(role => [role, Array.from(Keypair.generate().secretKey)])) as SecretKeys;
  try {
    const envelope = encryptKeys(keys, password);
    const directory = join(homedir(), "Library/Application Support/AfterKey/devnet-keys");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = join(directory, `${envelope.addresses.program}.enc.json`);
    writeFileSync(file, JSON.stringify(envelope, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    // Save the encrypted file before attempting Keychain access; the chosen
    // password remains an independent recovery method if Keychain is lost.
    let saved = true;
    try { keychain("add", envelope, password); } catch { saved = false; }
    console.log(JSON.stringify({ encryptedBackup: file, addresses: envelope.addresses, passwordSavedInKeychain: saved }, null, 2));
  } finally { for (const role of roles) keys[role].fill(0); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : "Keystore operation failed."); process.exitCode = 1; });
