import assert from "node:assert/strict";
import test from "node:test";
import { notificationProxy } from "../apps/web/src/lib/notification-proxy.ts";

const origin = "https://after-key-web.vercel.app";
const base = "https://api.example.test";
const session = "a".repeat(43);
const request = (method: string, headers: Record<string, string> = {}, body?: string) => new Request(origin + "/api/notifications/me", { method, headers, body });
test("same-origin proxy forwards only settings cookies and preserves private session responses", async () => {
  let calls = 0;
  const send: typeof fetch = async (url, options) => {
    calls++; assert.equal(String(url), base + "/me");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("cookie"), "__Host-afterkey-session=" + session);
    assert.equal(headers.get("origin"), origin); assert.equal(options?.redirect, "manual");
    return Response.json({ wallet: "test" }, { headers: { "Set-Cookie": `__Host-afterkey-session=${session}; Path=/; Secure; HttpOnly; SameSite=None` } });
  };
  const response = await notificationProxy(request("GET", { cookie: `unrelated_secret=private; __Host-afterkey-session=${session}` }), "/me", base, true, send);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/); assert.equal(response.headers.get("cache-control"), "no-store");
});
test("proxy rejects cross-site writes, arbitrary routes, credential URLs and production HTTP before forwarding", async () => {
  const send: typeof fetch = async () => { throw new Error("A rejected request must not reach the backend"); };
  assert.equal((await notificationProxy(request("PATCH", { origin: "https://attacker.test" }), "/me", base, true, send)).status, 403);
  assert.equal((await notificationProxy(request("GET"), "/admin", base, true, send)).status, 404);
  for (const invalid of ["https://user:password@api.example.test", "http://api.example.test", "http://127.0.0.1:8080", "https://api.example.test/extra"]) assert.equal((await notificationProxy(request("GET"), "/me", invalid, true, send)).status, 503);
  assert.equal((await notificationProxy(request("GET"), "/me", undefined, true, send)).status, 503);
});
test("redirects never carry sessions onward and oversized settings writes are refused", async () => {
  const redirect: typeof fetch = async () => new Response(null, { status: 302, headers: { Location: "https://attacker.test" } });
  assert.equal((await notificationProxy(request("GET"), "/me", base, true, redirect)).status, 503);
  const large = request("PATCH", { origin, "content-type": "application/json" }, JSON.stringify({ email: "x".repeat(9000) }));
  assert.equal((await notificationProxy(large, "/me", base, true, redirect)).status, 413);
});

test("internal server URLs preserve the browser-facing origin without trusting cross-site writes", async () => {
  const incoming = new Request("http://localhost:3102/api/notifications/auth/nonce", { method: "POST", headers: { host: "127.0.0.1:3102", origin: "http://127.0.0.1:3102", "content-type": "application/json" }, body: "{}" });
  const send: typeof fetch = async (_url, options) => { assert.equal(new Headers(options?.headers).get("origin"), "http://127.0.0.1:3102"); return Response.json({ ok: true }); };
  assert.equal((await notificationProxy(incoming, "/auth/nonce", "http://127.0.0.1:8081", false, send)).status, 200);
});
