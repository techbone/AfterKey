import assert from "node:assert/strict";
import test from "node:test";
import { createSignInMessageText } from "@solana/wallet-standard-util";
import { settingsSignInMessage, notificationProfile } from "../apps/web/src/lib/notifications.ts";

const origin = "https://after-key-web.vercel.app";
const wallet = "Bs7Uok84x4tiWy3hjohmRFcTjVJxtvXzE39WBQp54qSM";
const program = "DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7";
const now = Date.now();
function challenge() {
  const input = { domain: new URL(origin).host, address: wallet, statement: "Sign in to manage AfterKey email preferences. This does not authorize a vault transaction.", uri: origin + "/settings", version: "1", chainId: "solana:devnet", nonce: "a".repeat(32), issuedAt: new Date(now).toISOString(), expirationTime: new Date(now + 300000).toISOString(), resources: [`urn:afterkey:devnet:${program}:notifications`] };
  return { input, nonce: input.nonce, message: createSignInMessageText(input) };
}
test("settings signs only the expected wallet/site/network/purpose and an unexpired exact SIWS message", () => {
  const value = challenge(); assert.equal(settingsSignInMessage(value, wallet, origin, program, now).message, value.message);
  for (const changes of [{ address: "other wallet" }, { domain: "attacker.test" }, { uri: "https://attacker.test/settings" }, { chainId: "solana:mainnet" }, { statement: "Approve a transfer" }, { resources: ["other program"] }, { expirationTime: new Date(now - 1).toISOString() }, { expirationTime: new Date(now + 3600000).toISOString() }]) {
    const changed = { ...value, input: { ...value.input, ...changes } };
    assert.throws(() => settingsSignInMessage(changed, wallet, origin, program, now));
  }
  assert.throws(() => settingsSignInMessage({ ...value, message: value.message + "\nSign this extra instruction" }, wallet, origin, program, now));
  assert.throws(() => settingsSignInMessage(value, "different connected wallet", origin, program, now));
});
test("settings never displays an authenticated profile belonging to another wallet", () => {
  const profile = { wallet, email: "test@example.invalid", verifiedAt: null, enabled: false, checkinReminders: true, claimAlerts: true, version: "test" };
  assert.equal(notificationProfile(profile, wallet), profile);
  assert.throws(() => notificationProfile(profile, "different wallet"));
  assert.throws(() => notificationProfile(null, wallet));
});
