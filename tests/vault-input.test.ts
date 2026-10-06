import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { percentToBps, solToLamports, validateBeneficiaries, validateEscrowBalance } from "../apps/web/src/lib/vault-validation.ts";

test("SOL input preserves exact lamports and rejects unsafe amounts", () => {
  assert.equal(solToLamports("0.100000001"), 100_000_001n);
  assert.equal(solToLamports(".000000001"), 1n);
  assert.equal(solToLamports("0", true), 0n);
  for (const amount of ["0", "-1", "NaN", "Infinity", "1e3", "", "0.0000000001", "9007199.254740992"]) {
    assert.throws(() => solToLamports(amount), Error, amount);
  }
});

test("vault rent checks allow an empty escrow and prevent unusable remainders", () => {
  assert.doesNotThrow(() => validateEscrowBalance(0n, 890_880n));
  assert.doesNotThrow(() => validateEscrowBalance(890_880n, 890_880n));
  assert.throws(() => validateEscrowBalance(890_879n, 890_880n), /full SOL balance/);
});

test("beneficiary shares validate in basis points instead of floating point", () => {
  const owner = Keypair.generate().publicKey;
  const addresses = Array.from({ length: 3 }, () => Keypair.generate().publicKey.toBase58());
  const rows = addresses.map((address, i) => ({ address, percent: ["33.33", "33.33", "33.34"][i] }));
  assert.deepEqual(validateBeneficiaries(rows, owner).map(b => b.shareBps), [3333, 3333, 3334]);
  assert.equal(percentToBps(".01"), 1);
  assert.throws(() => validateBeneficiaries([{ ...rows[0], percent: "99.99" }], owner), /exactly 100/);
  assert.throws(() => validateBeneficiaries([{ address: addresses[0], percent: "50" }, { address: " " + addresses[0] + " ", percent: "50" }], owner), /different wallet/);
  assert.throws(() => validateBeneficiaries([{ address: owner.toBase58(), percent: "100" }], owner), /own beneficiary/);
  assert.throws(() => validateBeneficiaries([{ address: "not-a-wallet", percent: "100" }], owner), /valid wallet/);
  for (const percent of ["0", "-10", "0.001", "100.01", "NaN", "1e2"]) assert.throws(() => percentToBps(percent));
});
