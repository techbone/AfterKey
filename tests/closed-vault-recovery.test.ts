import test from "node:test";
import assert from "node:assert/strict";
import BN from "bn.js";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { recoverClosedVaultTransaction, receiveInheritanceTransaction } from "../apps/web/src/lib/vault-transactions.ts";
import { recoveryAllocations, recoveryPolicy } from "../apps/web/src/lib/vault-recovery.ts";
import { CHALLENGE, SOL, createVault, defaultBeneficiaries, expectError, fetchVault, newWorld, toInChallenge, toReleased, warp } from "./helpers.ts";

test("history recovery returns late SOL only to the owner of a permanently cancelled plan", async () => {
  const w = await newWorld();
  const v = await createVault(w);
  await w.program.methods.closeVault().accountsPartial({ vault: v.vault }).rpc();
  await w.provider.sendAndConfirm!(new Transaction().add(SystemProgram.transfer({ fromPubkey: w.owner.publicKey, toPubkey: v.solEscrow, lamports: SOL })), []);
  const record = await fetchVault(w, v);
  assert.equal(recoveryPolicy(record, w.heirA.publicKey).canAct, false);
  await assert.rejects(recoverClosedVaultTransaction(w.program, w.heirA.publicKey, v.vault, record, BigInt(SOL)), /Only the vault owner/);
  const before = w.client.getBalance(w.owner.publicKey)!;
  const tx = await recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, record, BigInt(SOL));
  assert.equal(tx.instructions.length, 1, "no second closure instruction is sent");
  await w.provider.sendAndConfirm!(tx, []);
  assert.ok(w.client.getBalance(w.owner.publicKey)! > before);
  assert.equal(w.client.getBalance(v.solEscrow) ?? 0n, 0n);
  assert.deepEqual((await fetchVault(w, v)).state, { closed: {} });
  assert.ok((await fetchVault(w, v)).claimer.equals(PublicKey.default));
});

test("completed-history recovery pays all saved beneficiaries with exact rounding and never reclaims for the owner", async () => {
  const w = await newWorld();
  const v = await createVault(w, { depositSol: new BN(SOL) });
  await toInChallenge(w, v);
  warp(w, CHALLENGE.toNumber() + 2);
  await w.provider.sendAndConfirm!(await receiveInheritanceTransaction(w.program, w.owner.publicKey, v.vault, defaultBeneficiaries(w), BigInt(SOL), true), []);
  const amount = BigInt(SOL) + 1n;
  await w.provider.sendAndConfirm!(new Transaction().add(SystemProgram.transfer({ fromPubkey: w.owner.publicKey, toPubkey: v.solEscrow, lamports: Number(amount) })), []);
  const record = await fetchVault(w, v);
  assert.equal(recoveryPolicy(record, w.owner.publicKey).action, "distribute");
  const before = [w.client.getBalance(w.heirA.publicKey)!, w.client.getBalance(w.heirB.publicKey)!];
  const malicious = { ...record, beneficiaries: [{ key: w.heirA.publicKey, shareBps: 6000 }, { key: w.owner.publicKey, shareBps: 4000 }] };
  await expectError(w.provider.sendAndConfirm!(await recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, malicious, amount), []), "NotBeneficiary");
  assert.equal(w.client.getBalance(w.heirA.publicKey), before[0], "partial payout rolls back on a substituted recipient");
  assert.equal(w.client.getBalance(v.solEscrow), amount);
  const allocations = recoveryAllocations(amount, record.beneficiaries);
  const ownerBefore = w.client.getBalance(w.owner.publicKey)!;
  await w.provider.sendAndConfirm!(await recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, record, amount), []);
  assert.equal(w.client.getBalance(w.heirA.publicKey)! - before[0], allocations[0].lamports);
  assert.equal(w.client.getBalance(w.heirB.publicKey)! - before[1], allocations[1].lamports);
  assert.equal(allocations[0].lamports + allocations[1].lamports, amount);
  assert.ok(w.client.getBalance(w.owner.publicKey)! < ownerBefore, "owner pays fees and gets no beneficiary payout");
  assert.deepEqual((await fetchVault(w, v)).state, { closed: {} });
  await expectError(w.program.methods.withdrawSol(new BN(0)).accountsPartial({ vault: v.vault }).rpc(), "WrongState");
});

test("recovery cannot finalize an active/released plan or sign an empty recovery", async () => {
  const w = await newWorld();
  const v = await createVault(w, { depositSol: new BN(SOL) });
  await assert.rejects(recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, await fetchVault(w, v), BigInt(SOL)), /not closed/);
  await toReleased(w, v);
  await assert.rejects(recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, await fetchVault(w, v), BigInt(SOL)), /not closed/);
  const empty = await createVault(w);
  await w.program.methods.closeVault().accountsPartial({ vault: empty.vault }).rpc();
  await assert.rejects(recoverClosedVaultTransaction(w.program, w.owner.publicKey, empty.vault, await fetchVault(w, empty), 0n), /No SOL/);
});

test("a paused program still allows recovery from the history transaction builder", async () => {
  const w = await newWorld();
  const v = await createVault(w);
  await w.program.methods.closeVault().accountsPartial({ vault: v.vault }).rpc();
  await w.program.methods.updateAdminConfig(true, null, null, null).rpc();
  await w.provider.sendAndConfirm!(new Transaction().add(SystemProgram.transfer({ fromPubkey: w.owner.publicKey, toPubkey: v.solEscrow, lamports: SOL })), []);
  await w.provider.sendAndConfirm!(await recoverClosedVaultTransaction(w.program, w.owner.publicKey, v.vault, await fetchVault(w, v), BigInt(SOL)), []);
  assert.equal(w.client.getBalance(v.solEscrow) ?? 0n, 0n);
});
