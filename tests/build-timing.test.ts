import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { newWorld } from "./helpers.ts";

test("compiled timing minimums match the intended environment", async () => {
  const w = await newWorld();
  const [address] = PublicKey.findProgramAddressSync([Buffer.from("config")], w.programId);
  const config = await w.program.account.config.fetch(address);
  const devnet = process.env.AFTERKEY_TEST_TIMING === "devnet";
  assert.equal(config.minInactivitySecs.toNumber(), devnet ? 60 : 30 * 86_400);
  assert.equal(config.minChallengeSecs.toNumber(), devnet ? 30 : 7 * 86_400);
});
