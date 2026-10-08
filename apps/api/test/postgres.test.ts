import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { PostgresStore } from "../src/postgres.js";
import { PostgresQueue } from "../src/pg-queue.js";
import { defaultProfile, type EmailJob } from "../src/types.js";

// Opt-in only: never migrate an ordinary application database during tests.
const url = process.env.AFTERKEY_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) {
    throw new Error("Integration tests require a localhost database whose name ends in _test.");
  }
}

test("PostgreSQL persists private preferences and consumes nonces/tokens atomically", { skip: !url }, async () => {
  let store = new PostgresStore(url!);
  const id = randomUUID(); const now = new Date(); const expiry = new Date(now.getTime() + 60_000);
  try {
    const migration = await readFile(new URL("../migrations/001_notifications.sql", import.meta.url), "utf8");
    await store.pool.query(migration);
    await store.pool.query(migration); // Safe to rerun during setup.
    await store.putChallenge({ id, wallet: id, message: "test proof", expiresAt: expiry });
    const consumed = await Promise.all(Array.from({ length: 12 }, () => store.consumeChallenge(id, now)));
    assert.equal(consumed.filter(Boolean).length, 1);
    const rate = await Promise.all(Array.from({ length: 12 }, () => store.claimEmailRate(id, now)));
    assert.equal(rate.filter(Boolean).length, 1);
    assert.equal(await store.claimEmailRate(id, new Date(now.getTime() + 601_000)), true);
    const profile = { ...defaultProfile(id), email: "test@example.invalid", enabled: true, version: id };
    await store.putProfile(profile);
    await store.putSession({ hash: id, wallet: id, expiresAt: expiry });
    await store.putEmailToken({ hash: id, wallet: id, email: profile.email, version: id, expiresAt: expiry });
    const verified = await Promise.all(Array.from({ length: 12 }, () => store.verifyEmail(id, now)));
    assert.equal(verified.filter(Boolean).length, 1);
    await store.startDelivery(id, now);
    await store.finishDelivery(id, "sent");
    const vault = { address: id, owner: id, state: "closed" as const, lastCheckin: 1, inactivitySeconds: 60, claimInitiatedAt: 0, challengeSeconds: 30 };
    await store.putVault(vault);
    await store.close(); store = new PostgresStore(url!);
    assert.equal((await store.getProfile(id)).verifiedAt?.getTime(), now.getTime());
    assert.equal((await store.getSession(id))?.wallet, id);
    assert.equal((await store.getDelivery(id))?.status, "sent");
    assert.deepEqual(await store.getVault(id), vault);
    const privateTables = await store.pool.query("select relrowsecurity from pg_class where relname like 'afterkey_%' and relkind = 'r'");
    assert.equal(privateTables.rows.length, 7);
    assert.ok(privateTables.rows.every(row => row.relrowsecurity));
    await store.deleteUser(id);
    assert.equal((await store.getProfile(id)).email, null);
    assert.equal(await store.getSession(id), null);
    assert.equal(await store.getEmailToken(id), null);
  } finally { await store.close(); }
});

test("pg-boss deduplicates jobs and retries a failure after worker restart", { skip: !url, timeout: 100_000 }, async () => {
  let queue = new PostgresQueue(url!);
  let attempts = 0;
  const job: EmailJob = { key: randomUUID(), kind: "verify", wallet: "test", version: "test" };
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 85_000;
    while (!predicate()) { assert.ok(Date.now() < deadline, "Timed out waiting for durable queue retry"); await delay(100); }
  };
  try {
    await queue.start();
    const due = new Date(Date.now() + 500);
    await queue.enqueue(job, due); await queue.enqueue(job, due);
    await queue.work(async value => {
      assert.equal(value.key, job.key); attempts++;
      throw new Error("Simulated first delivery failure; no email is sent.");
    });
    await until(() => attempts === 1);
    await delay(500); // Let the worker durably record the failure before stopping.
    await queue.stop(); queue = new PostgresQueue(url!);
    await queue.start();
    await queue.work(async value => { assert.equal(value.key, job.key); attempts++; });
    await until(() => attempts === 2);
    await delay(2_500);
    assert.equal(attempts, 2, "Duplicate enqueue must not create a second delivery");
  } finally { await queue.stop(); }
});
