import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { newWorld } from "./helpers.ts";
import { BUFFER_HEADER_BYTES, UPGRADEABLE_LOADER, UPLOAD_CHUNK_BYTES, bufferWriteInstruction, missingBufferChunks } from "../scripts/lib/program-upload.ts";

test("paced uploader instructions execute under loader-v3 and reject another authority", async () => {
  const world = await newWorld();
  assert.ok(world.provider.sendAndConfirm);
  const send = world.provider.sendAndConfirm.bind(world.provider);
  const buffer = Keypair.generate();
  const bytes = Buffer.alloc(1800, 7);
  await send(new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: world.owner.publicKey, newAccountPubkey: buffer.publicKey, lamports: 50_000_000, space: bytes.length + BUFFER_HEADER_BYTES, programId: UPGRADEABLE_LOADER }),
    new TransactionInstruction({ programId: UPGRADEABLE_LOADER, data: Buffer.alloc(4), keys: [
      { pubkey: buffer.publicKey, isSigner: false, isWritable: true }, { pubkey: world.owner.publicKey, isSigner: false, isWritable: false }
    ] })
  ), [buffer]);
  const tx = new Transaction().add(bufferWriteInstruction(buffer.publicKey, world.owner.publicKey, 0, bytes.subarray(0, UPLOAD_CHUNK_BYTES)));
  tx.feePayer = world.owner.publicKey;
  tx.recentBlockhash = SystemProgram.programId.toBase58();
  assert.ok(tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232);
  await send(tx);
  const uploaded = () => Buffer.from(world.client.getAccount(buffer.publicKey)!.data).subarray(BUFFER_HEADER_BYTES);
  assert.ok(uploaded().subarray(0, 900).equals(bytes.subarray(0, 900)));
  assert.deepEqual(missingBufferChunks(bytes, uploaded()), [900]);
  await assert.rejects(send(new Transaction().add(bufferWriteInstruction(buffer.publicKey, world.stranger.publicKey, 900, bytes.subarray(900))), [world.stranger]));
  assert.deepEqual(missingBufferChunks(bytes, uploaded()), [900]);
  await send(new Transaction().add(bufferWriteInstruction(buffer.publicKey, world.owner.publicKey, 900, bytes.subarray(900))));
  assert.ok(uploaded().equals(bytes));
  assert.deepEqual(missingBufferChunks(bytes, uploaded()), []);
});
