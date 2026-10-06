import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";

export const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
export const BUFFER_HEADER_BYTES = 37;
export const UPLOAD_CHUNK_BYTES = 900;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Loader-v3 Write: bincode u32 enum tag, u32 offset, u64 byte length, bytes.
 * Matches solana-loader-v3-interface's instruction::write; exercised in LiteSVM.
 */
export function bufferWriteInstruction(buffer: PublicKey, authority: PublicKey, offset: number, bytes: Buffer) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 0xffffffff || bytes.length > UPLOAD_CHUNK_BYTES) throw new Error("Invalid buffer write range.");
  const data = Buffer.alloc(16 + bytes.length);
  data.writeUInt32LE(1, 0);
  data.writeUInt32LE(offset, 4);
  data.writeBigUInt64LE(BigInt(bytes.length), 8);
  bytes.copy(data, 16);
  return new TransactionInstruction({ programId: UPGRADEABLE_LOADER, keys: [
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false }
  ], data });
}

export function missingBufferChunks(bytes: Buffer, uploaded: Buffer) {
  const offsets: number[] = [];
  for (let offset = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES);
    if (!chunk.equals(uploaded.subarray(offset, offset + chunk.length))) offsets.push(offset);
  }
  return offsets;
}

export async function uploadProgramBuffer(connection: Connection, payer: Keypair, bufferSigner: Keypair, bytes: Buffer) {
  const buffer = bufferSigner.publicKey;
  let account = await connection.getAccountInfo(buffer);
  if (!account) {
    const tx = new Transaction().add(
      SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: buffer,
        lamports: await connection.getMinimumBalanceForRentExemption(bytes.length + 45),
        space: bytes.length + BUFFER_HEADER_BYTES, programId: UPGRADEABLE_LOADER }),
      new TransactionInstruction({ programId: UPGRADEABLE_LOADER, data: Buffer.alloc(4), keys: [
        { pubkey: buffer, isSigner: false, isWritable: true }, { pubkey: payer.publicKey, isSigner: false, isWritable: false }
      ] })
    );
    await sendAndConfirmTransaction(connection, tx, [payer, bufferSigner], { commitment: "confirmed" });
    account = await connection.getAccountInfo(buffer);
  }
  if (!account || !account.owner.equals(UPGRADEABLE_LOADER) || account.data.readUInt32LE(0) !== 1 || account.data[4] !== 1
      || !new PublicKey(account.data.subarray(5, 37)).equals(payer.publicKey) || account.data.length !== bytes.length + BUFFER_HEADER_BYTES) {
    throw new Error("Upload buffer does not match the intended authority and binary size.");
  }
  const pending = missingBufferChunks(bytes, account.data.subarray(BUFFER_HEADER_BYTES));
  console.log("buffer chunks requiring upload:", pending.length);
  let reportedAt = Date.now();
  for (let index = 0; index < pending.length; index++) {
    const offset = pending[index];
    const startedAt = Date.now();
    for (let attempt = 0; ; attempt++) {
      try {
        const tx = new Transaction().add(bufferWriteInstruction(buffer, payer.publicKey, offset, bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES)));
        await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed", preflightCommitment: "confirmed", maxRetries: 3 });
        break;
      } catch (error) {
        if (attempt >= 2 || !(error instanceof Error) || !/429|timed out|block height exceeded|fetch failed|socket|ECONN|BlockhashNotFound/i.test(error.message)) throw error;
        console.log("Transient RPC interruption; waiting 10 seconds before retrying this idempotent write.");
        await delay(10_000);
      }
    }
    if (Date.now() - reportedAt >= 20_000 || index === pending.length - 1) {
      console.log(`buffer upload: ${index + 1}/${pending.length} missing chunks confirmed`);
      reportedAt = Date.now();
    }
    await delay(Math.max(0, 1000 - (Date.now() - startedAt)));
  }
  const completed = await connection.getAccountInfo(buffer);
  if (!completed || !bytes.equals(completed.data.subarray(BUFFER_HEADER_BYTES))) throw new Error("Buffer bytes differ from the intended artifact; final deployment was not sent.");
  console.log("upload buffer matches the tested artifact:", true);
}
