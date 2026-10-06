import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { decryptKeys, encryptKeys } from "../scripts/devnet-keystore.ts";

test("encrypted deployment backups round-trip and authenticate keys and metadata", () => {
  const keys = { authority: Array.from(Keypair.generate().secretKey), program: Array.from(Keypair.generate().secretKey), buffer: Array.from(Keypair.generate().secretKey) };
  const password = "test-only backup password";
  const encrypted = encryptKeys(keys, password);
  const decrypted = decryptKeys(encrypted, password);
  for (const role of ["authority", "program", "buffer"] as const) {
    assert.ok(Buffer.from(decrypted[role]).equals(Buffer.from(keys[role])));
    assert.ok(!JSON.stringify(encrypted).includes(JSON.stringify(keys[role])));
  }
  assert.throws(() => decryptKeys(encrypted, "another test password"));
  const tampered = structuredClone(encrypted);
  tampered.addresses.authority = Keypair.generate().publicKey.toBase58();
  assert.throws(() => decryptKeys(tampered, password));
  const damaged = structuredClone(encrypted);
  const ciphertext = Buffer.from(damaged.ciphertext, "base64");
  ciphertext[0] ^= 1;
  damaged.ciphertext = ciphertext.toString("base64");
  assert.throws(() => decryptKeys(damaged, password));
  const second = encryptKeys(keys, password);
  assert.notEqual(second.salt, encrypted.salt);
  assert.notEqual(second.nonce, encrypted.nonce);
  assert.notEqual(second.ciphertext, encrypted.ciphertext);
  assert.throws(() => encryptKeys(keys, "too short"));
});
