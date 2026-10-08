import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { createApp } from "../src/app.js";
import { digest } from "../src/auth.js";
import { readConfig } from "../src/config.js";
import { MemoryQueue, MemoryStore } from "../src/memory.js";
import { DisabledMailer, ResendMailer } from "../src/mailer.js";
import { NotificationEngine } from "../src/notifications.js";
import type { Mail, Mailer, VaultSnapshot, VaultSource } from "../src/types.js";

const ORIGIN = "https://app.example.test";
const PROGRAM = "DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7";
class TestMailer implements Mailer {
  enabled = true; messages: Mail[] = []; delivered = new Set<string>(); loseResponse = false;
  async send(mail: Mail) {
    if (!this.delivered.has(mail.key)) { this.messages.push(structuredClone(mail)); this.delivered.add(mail.key); }
    if (this.loseResponse) { this.loseResponse = false; throw new Error("Simulated response lost after provider accepted email"); }
  }
}
class TestSource implements VaultSource {
  values = new Map<string, VaultSnapshot>(); reads = 0;
  async list() { return structuredClone([...this.values.values()]); }
  async get(address: string) { this.reads++; return structuredClone(this.values.get(address) ?? null); }
}
function signature(key: Keypair, message: string) {
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(key.secretKey.subarray(0, 32))]), type: "pkcs8", format: "der" });
  return sign(null, Buffer.from(message), privateKey).toString("base64");
}
async function fixture(mailer: Mailer = new TestMailer()) {
  let time = Date.parse("2026-10-07T12:00:00Z");
  const now = () => new Date(time);
  const advance = (seconds: number) => { time += seconds * 1000; };
  const owner = Keypair.generate(); const wallet = owner.publicKey.toBase58();
  const store = new MemoryStore(); const queue = new MemoryQueue(); const source = new TestSource();
  const app = await createApp({ store, queue, mailer, origin: ORIGIN, programId: PROGRAM, mode: "test", now });
  const engine = new NotificationEngine(store, queue, source, mailer, ORIGIN, now);
  await engine.start();
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: "POST", url, payload, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });
  const nonce = async () => (await post("/auth/nonce", { wallet })).json();
  const login = async () => {
    const value = await nonce(); const response = await post("/auth/siws", { wallet, nonce: value.nonce, signature: signature(owner, value.message) });
    assert.equal(response.statusCode, 200);
    return (response.headers["set-cookie"] as string).split(";")[0];
  };
  const patch = (cookie: string, payload: object) => app.inject({ method: "PATCH", url: "/me", payload, headers: { origin: ORIGIN, cookie } });
  const optIn = async () => {
    const cookie = await login();
    const response = await patch(cookie, { email: "owner@example.test", enabled: true }); assert.equal(response.statusCode, 200);
    assert.equal(response.json().verifiedAt, null);
    await queue.runDue(now());
    const message = (mailer as TestMailer).messages[0];
    const token = new URL(message.text.split("\n").find(line => line.startsWith(ORIGIN))!).hash.split("verify=")[1];
    assert.equal((await post("/me/verify-email", { token })).statusCode, 200);
    return { cookie, token };
  };
  const vault = (): VaultSnapshot => ({ address: Keypair.generate().publicKey.toBase58(), owner: wallet, state: "active", lastCheckin: Math.floor(time / 1000), inactivitySeconds: 120, claimInitiatedAt: 0, challengeSeconds: 60 });
  return { app, owner, wallet, store, queue, source, mailer, engine, now, advance, post, nonce, login, patch, optIn, vault };
}

test("wallet proof is domain-bound, single-use, and sets a private session cookie", async () => {
  const f = await fixture();
  try {
    const n = await f.nonce();
    assert.ok(n.message.includes(`URI: ${ORIGIN}/settings`));
    assert.ok(n.message.includes(PROGRAM));
    const wrong = signature(f.owner, n.message.replace("app.example.test", "attacker.example.test"));
    assert.equal((await f.post("/auth/siws", { wallet: f.wallet, nonce: n.nonce, signature: wrong })).statusCode, 401);
    const valid = { wallet: f.wallet, nonce: n.nonce, signature: signature(f.owner, n.message) };
    const results = await Promise.all([f.post("/auth/siws", valid), f.post("/auth/siws", valid)]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 401]);
    const response = results.find(r => r.statusCode === 200)!;
    const cookie = response.headers["set-cookie"] as string;
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=None/);
    assert.equal(response.json().token, undefined);
    const token = cookie.split("=")[1].split(";")[0];
    assert.ok(f.store.sessions.has(digest(token))); assert.ok(!f.store.sessions.has(token));
    const otherWallet = Keypair.generate(); const second = await f.nonce();
    assert.equal((await f.post("/auth/siws", { wallet: f.wallet, nonce: second.nonce, signature: signature(otherWallet, second.message) })).statusCode, 401);
    f.advance(301);
    assert.equal((await f.post("/auth/siws", { wallet: f.wallet, nonce: second.nonce, signature: signature(f.owner, second.message) })).statusCode, 401);
  } finally { await f.app.close(); }
});

test("CSRF, authentication and disabled delivery fail closed without enabling preferences", async () => {
  const f = await fixture(new DisabledMailer());
  try {
    assert.equal((await f.app.inject({ method: "GET", url: "/me" })).statusCode, 401);
    assert.equal((await f.app.inject({ method: "POST", url: "/auth/nonce", payload: { wallet: f.wallet }, headers: { origin: "https://attacker.example.test" } })).statusCode, 403);
    const cookie = await f.login();
    assert.equal((await f.patch(cookie, { email: "owner@example.test", enabled: true })).statusCode, 503);
    assert.equal((await f.store.getProfile(f.wallet)).enabled, false);
    assert.equal(f.queue.jobs.size, 0);
    assert.equal((await f.patch(cookie, { wallet: Keypair.generate().publicKey.toBase58() })).statusCode, 400);
    f.advance(3601);
    assert.equal((await f.app.inject({ method: "GET", url: "/me", headers: { cookie } })).statusCode, 401);
  } finally { await f.app.close(); }
});

test("email verification is required, one-use, and survives pre-verification preference changes", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    assert.equal((await f.patch(cookie, { email: "owner@example.test", enabled: true })).statusCode, 200);
    assert.equal((await f.patch(cookie, { claimAlerts: false })).statusCode, 200);
    await f.queue.runDue(f.now());
    const message = (f.mailer as TestMailer).messages[0];
    const token = new URL(message.text.split("\n").find(line => line.startsWith(ORIGIN))!).hash.split("verify=")[1];
    assert.ok(!JSON.stringify([...f.store.tokens.values()]).includes(token), "persistent token record contains only the hash");
    assert.equal((await f.post("/me/verify-email", { token })).statusCode, 200);
    assert.equal((await f.post("/me/verify-email", { token })).statusCode, 400);
    assert.ok((await f.store.getProfile(f.wallet)).verifiedAt);
    assert.equal((await f.store.getProfile(f.wallet)).claimAlerts, false);
    assert.equal((await f.patch(cookie, { email: "replacement@example.test" })).statusCode, 200);
    assert.equal((await f.store.getProfile(f.wallet)).verifiedAt, null);
    assert.equal((await f.patch(cookie, { email: "replacement@example.test" })).statusCode, 429);
  } finally { await f.app.close(); }
});

test("check-ins supersede old reminders and reconciliation repairs projection drift", async () => {
  const f = await fixture();
  try {
    await f.optIn(); const v = f.vault(); f.source.values.set(v.address, v);
    await f.engine.reconcile(); await f.engine.reconcile(); assert.equal(f.queue.jobs.size, 3);
    f.advance(61); v.lastCheckin += 61;
    f.source.values.set(v.address, structuredClone(v));
    await f.queue.runDue(f.now());
    assert.equal((f.mailer as TestMailer).messages.length, 1, "old due reminder is skipped after authoritative check-in");
    await f.store.putVault({ ...v, owner: "wrong-projection", state: "closed" });
    assert.equal((await f.engine.reconcile()).corrected, 1);
    assert.equal((await f.store.getVault(v.address))!.owner, f.wallet);
    f.advance(61); await f.queue.runDue(f.now());
    const reminders = (f.mailer as TestMailer).messages.filter(m => m.subject.includes("check-in"));
    assert.equal(reminders.length, 1);
    assert.ok(f.source.reads >= 2, "eligibility is re-read from chain rather than trusted from the cache");
  } finally { await f.app.close(); }
});

test("claim alerts enqueue immediately, deduplicate, and are suppressed after veto or closure", async () => {
  const f = await fixture();
  try {
    await f.optIn(); const v = f.vault(); v.state = "inChallenge"; v.claimInitiatedAt = Math.floor(f.now().getTime() / 1000);
    f.source.values.set(v.address, v); await f.engine.reconcile(); await f.engine.reconcile();
    assert.equal(f.queue.jobs.size, 1); await f.queue.runDue(f.now());
    assert.equal((f.mailer as TestMailer).messages.filter(m => m.subject.includes("claim")).length, 1);
    await f.engine.reconcile(); assert.equal(f.queue.jobs.size, 0);
    v.claimInitiatedAt += 120; f.source.values.set(v.address, v); await f.engine.reconcile();
    v.state = "active"; f.source.values.set(v.address, v); await f.queue.runDue(f.now());
    assert.equal((f.mailer as TestMailer).messages.filter(m => m.subject.includes("claim")).length, 1);
    v.state = "inChallenge"; v.claimInitiatedAt += 120; f.source.values.set(v.address, v); await f.engine.reconcile();
    v.state = "closed"; f.source.values.set(v.address, v); await f.queue.runDue(f.now());
    assert.equal((f.mailer as TestMailer).messages.filter(m => m.subject.includes("claim")).length, 1);
  } finally { await f.app.close(); }
});

test("lost provider responses retry with the same idempotency key and no duplicate delivery", async () => {
  const f = await fixture();
  try {
    await f.optIn(); const v = f.vault(); v.state = "inChallenge"; v.claimInitiatedAt = Math.floor(f.now().getTime() / 1000);
    f.source.values.set(v.address, v); await f.engine.reconcile();
    (f.mailer as TestMailer).loseResponse = true;
    await f.queue.runDue(f.now()); assert.equal(f.queue.jobs.size, 1);
    f.advance(30); await f.queue.runDue(f.now()); assert.equal(f.queue.jobs.size, 0);
    assert.equal((f.mailer as TestMailer).messages.filter(m => m.subject.includes("claim")).length, 1);
  } finally { await f.app.close(); }
});

test("disabling/deleting preferences suppresses queued mail and removes sessions", async () => {
  const f = await fixture();
  try {
    const { cookie } = await f.optIn(); const v = f.vault(); f.source.values.set(v.address, v); await f.engine.reconcile();
    assert.equal((await f.patch(cookie, { enabled: false })).statusCode, 200);
    f.advance(61); await f.queue.runDue(f.now()); assert.equal((f.mailer as TestMailer).messages.length, 1);
    assert.equal((await f.app.inject({ method: "DELETE", url: "/me", headers: { cookie, origin: ORIGIN } })).statusCode, 200);
    assert.equal((await f.app.inject({ method: "GET", url: "/me", headers: { cookie } })).statusCode, 401);
    assert.equal((await f.store.getProfile(f.wallet)).email, null);
  } finally { await f.app.close(); }
});

test("production requires durable storage, HTTPS, and complete provider configuration", () => {
  assert.throws(() => readConfig({ API_STORAGE: "memory", NODE_ENV: "production" }), /volatile/);
  assert.throws(() => readConfig({ API_STORAGE: "postgres" }), /DATABASE_URL/);
  assert.throws(() => readConfig({ API_STORAGE: "memory", RESEND_API_KEY: "test-only" }), /both/);
  assert.throws(() => readConfig({ API_STORAGE: "memory", RESEND_API_KEY: "test-only", RESEND_FROM: "test@example.test", NOTIFICATIONS_DELIVERY_ENABLED: "true" }), /durable/);
  assert.equal(readConfig({ API_STORAGE: "memory", RESEND_API_KEY: "test-only", RESEND_FROM: "test@example.test" }).deliveryEnabled, false);
  assert.equal(readConfig({ API_STORAGE: "memory" }).mode, "memory");
});

test("unverified owners never receive reminders and obsolete email tokens cannot bind a replacement address", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    await f.patch(cookie, { email: "first@example.test", enabled: true });
    const first = [...f.queue.jobs.values()][0].job.token!;
    const v = f.vault(); f.source.values.set(v.address, v);
    await f.engine.reconcile(); assert.equal(f.queue.jobs.size, 1, "only verification is queued before email ownership is proved");
    await f.patch(cookie, { email: "second@example.test" });
    assert.equal((await f.post("/me/verify-email", { token: first })).statusCode, 400);
    f.advance(1801);
    const second = [...f.queue.jobs.values()].find(j => j.job.token !== first)!.job.token!;
    assert.equal((await f.post("/me/verify-email", { token: second })).statusCode, 400);
  } finally { await f.app.close(); }
});

test("an uncertain delivery is not retried outside the provider idempotency window", async () => {
  const f = await fixture();
  try {
    await f.optIn(); const v = f.vault(); v.state = "inChallenge"; v.claimInitiatedAt = Math.floor(f.now().getTime() / 1000);
    f.source.values.set(v.address, v); await f.engine.reconcile();
    (f.mailer as TestMailer).loseResponse = true;
    await f.queue.runDue(f.now()); const key = [...f.queue.jobs.keys()][0];
    f.advance(23 * 3600); await f.queue.runDue(f.now());
    assert.equal((await f.store.getDelivery(key))!.status, "expired");
    assert.equal((f.mailer as TestMailer).messages.filter(m => m.subject.includes("claim")).length, 1);
  } finally { await f.app.close(); }
});

test("Resend requests use the logical delivery key and do not expose provider error bodies", async t => {
  let request: { input: unknown; init: RequestInit | undefined } | undefined;
  t.mock.method(globalThis, "fetch", async (input: unknown, init: RequestInit) => { request = { input, init }; return new Response("{}", { status: 200 }); });
  const mailer = new ResendMailer("test-only-key", "AfterKey <sender@example.test>");
  await mailer.send({ key: "logical-job", to: "owner@example.test", subject: "Reminder", text: "Test-only message" });
  assert.equal(request!.input, "https://api.resend.com/emails");
  assert.equal((request!.init!.headers as Record<string, string>)["Idempotency-Key"], "afterkey/logical-job");
  assert.deepEqual(JSON.parse(request!.init!.body as string).to, ["owner@example.test"]);
  t.mock.method(globalThis, "fetch", async () => new Response("private provider diagnostic", { status: 503 }));
  await assert.rejects(mailer.send({ key: "logical-job", to: "owner@example.test", subject: "Reminder", text: "Test" }), error => error instanceof Error && error.message === "Email provider returned HTTP 503.");
});
