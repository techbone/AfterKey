import { test } from "node:test";
import assert from "node:assert/strict";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { cancelVaultTransaction, createVaultTransaction, receiveInheritanceTransaction } from "../apps/web/src/lib/vault-transactions.ts";
import { CHALLENGE, INACTIVITY, SOL, createVault, defaultBeneficiaries, expectError, fetchVault, newWorld, toInChallenge, warp } from "./helpers.ts";

test("creation and deposit commit together; failed funding leaves no vault", async () => {
  const w = await newWorld();
  const build = (id: number, amount: bigint) => createVaultTransaction(w.program, w.owner.publicKey, new BN(id), INACTIVITY.toNumber(), CHALLENGE.toNumber(), defaultBeneficiaries(w), amount);
  const good = await build(101, BigInt(SOL));
  await w.provider.sendAndConfirm!(good.transaction, []);
  const account = await w.program.account.vault.fetch(good.vault);
  assert.deepEqual(account.state, { active: {} });
  const bad = await build(102, BigInt(2_000 * SOL));
  await assert.rejects(w.provider.sendAndConfirm!(bad.transaction, []));
  assert.equal(w.client.getAccount(bad.vault), null, "initialization rolls back when the deposit fails");
});

test("empty and funded challenge vaults cancel with one transaction", async () => {
  const w = await newWorld();
  for (const amount of [0n, BigInt(SOL)]) {
    const v = await createVault(w, { depositSol: new BN(amount.toString()) });
    await toInChallenge(w, v);
    const tx = await cancelVaultTransaction(w.program, w.owner.publicKey, v.vault, amount, true);
    await w.provider.sendAndConfirm!(tx, []);
    const account = await fetchVault(w, v);
    assert.deepEqual(account.state, { closed: {} });
    assert.ok(account.claimer.equals(PublicKey.default));
    assert.equal(w.client.getBalance(v.solEscrow) ?? 0n, 0n);
    await expectError(w.program.methods.checkIn().accountsPartial({ vault: v.vault }).rpc(), "WrongState");
  }
});

test("inheritance payout and completion roll back together on a bad recipient", async () => {
  const w = await newWorld();
  const v = await createVault(w, { depositSol: new BN(SOL) });
  await toInChallenge(w, v);
  warp(w, CHALLENGE.toNumber() + 2);
  const before = w.client.getBalance(w.heirA.publicKey);
  const badRecipients = [{ key: w.heirA.publicKey, shareBps: 6000 }, { key: w.stranger.publicKey, shareBps: 4000 }];
  const bad = await receiveInheritanceTransaction(w.program, w.owner.publicKey, v.vault, badRecipients, BigInt(SOL), true);
  await expectError(w.provider.sendAndConfirm!(bad, []), "NotBeneficiary");
  assert.equal(w.client.getBalance(w.heirA.publicKey), before);
  assert.equal(w.client.getBalance(v.solEscrow), BigInt(SOL));
  assert.deepEqual((await fetchVault(w, v)).state, { inChallenge: {} }, "finalization also rolls back when a payout fails");
  const good = await receiveInheritanceTransaction(w.program, w.owner.publicKey, v.vault, defaultBeneficiaries(w), BigInt(SOL), true);
  await w.provider.sendAndConfirm!(good, []);
  assert.equal(w.client.getBalance(w.heirA.publicKey)! - before!, BigInt(SOL * 0.6));
  assert.deepEqual((await fetchVault(w, v)).state, { closed: {} });
  await expectError(w.program.methods.withdrawSol(new BN(0)).accountsPartial({ vault: v.vault }).rpc(), "WrongState");
});

test("a maximum-size beneficiary plan fits the atomic create and payout transactions", async () => {
  const w = await newWorld();
  const heirs = Array.from({ length: 10 }, () => Keypair.generate());
  const beneficiaries = heirs.map(heir => ({ key: heir.publicKey, shareBps: 1000 }));
  const built = await createVaultTransaction(w.program, w.owner.publicKey, new BN(103), INACTIVITY.toNumber(), CHALLENGE.toNumber(), beneficiaries, BigInt(SOL));
  await w.provider.sendAndConfirm!(built.transaction, []);
  warp(w, INACTIVITY.toNumber() + 2);
  await w.program.methods.initiateClaim().accountsPartial({ claimer: heirs[0].publicKey, vault: built.vault }).signers([heirs[0]]).rpc();
  warp(w, CHALLENGE.toNumber() + 2);
  const payout = await receiveInheritanceTransaction(w.program, w.owner.publicKey, built.vault, beneficiaries, BigInt(SOL), true);
  await w.provider.sendAndConfirm!(payout, []);
  assert.ok(payout.serialize().length <= 1232, "fits Solana's transaction packet limit");
  for (const heir of heirs) assert.equal(w.client.getBalance(heir.publicKey), BigInt(SOL / 10));
});

test("SOL sent after closure still goes to the correct recovery party", async () => {
  const w = await newWorld();
  const cancelled = await createVault(w);
  await w.program.methods.closeVault().accountsPartial({ vault: cancelled.vault }).rpc();
  await w.provider.sendAndConfirm!(new Transaction().add(SystemProgram.transfer({ fromPubkey: w.owner.publicKey, toPubkey: cancelled.solEscrow, lamports: SOL })), []);
  await w.program.methods.withdrawSol(new BN(SOL)).accountsPartial({ vault: cancelled.vault }).rpc();
  assert.equal(w.client.getBalance(cancelled.solEscrow) ?? 0n, 0n);

  const inherited = await createVault(w, { depositSol: new BN(SOL) });
  await toInChallenge(w, inherited);
  warp(w, CHALLENGE.toNumber() + 2);
  await w.provider.sendAndConfirm!(await receiveInheritanceTransaction(w.program, w.owner.publicKey, inherited.vault, defaultBeneficiaries(w), BigInt(SOL), true), []);
  await w.provider.sendAndConfirm!(new Transaction().add(SystemProgram.transfer({ fromPubkey: w.owner.publicKey, toPubkey: inherited.solEscrow, lamports: SOL })), []);
  await expectError(w.program.methods.withdrawSol(new BN(SOL)).accountsPartial({ vault: inherited.vault }).rpc(), "WrongState");
  const before = w.client.getBalance(w.heirA.publicKey)!;
  await w.program.methods.distributeSol().accountsPartial({ cranker: w.owner.publicKey, vault: inherited.vault })
    .remainingAccounts(defaultBeneficiaries(w).map(b => ({ pubkey: b.key, isWritable: true, isSigner: false }))).rpc();
  assert.equal(w.client.getBalance(w.heirA.publicKey)! - before, BigInt(SOL * 0.6));
});
