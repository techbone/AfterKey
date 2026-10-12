import assert from "node:assert/strict";
import test from "node:test";
import { databaseUrl } from "../src/database-url.js";
import { readConfig } from "../src/config.js";
import { createApp } from "../src/app.js";
import { MemoryStore, MemoryQueue } from "../src/memory.js";
import { DisabledMailer } from "../src/mailer.js";

test("Supabase connections validate TLS with this runtime's certificate path", () => {
  const result = new URL(databaseUrl("postgresql://postgres.project:test@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=disable&ssl=false&sslrootcert=/old-mac/path"));
  assert.equal(result.searchParams.get("sslmode"), "verify-full"); assert.equal(result.searchParams.get("ssl"), null);
  assert.ok(result.searchParams.get("sslrootcert")?.endsWith("apps/api/certs/supabase-prod-ca-2021.crt"));
  assert.equal(result.username, "postgres.project"); assert.equal(result.password, "test");
  assert.equal(new URL(databaseUrl("postgresql://test@127.0.0.1/test")).searchParams.get("sslmode"), null);
  assert.throws(() => databaseUrl("https://example.test"));
});
test("hosting port is respected and health fails when storage is unavailable", async () => {
  assert.equal(readConfig({ API_STORAGE: "memory", PORT: "4321" }).port, 4321);
  const app = await createApp({ store: new MemoryStore(), queue: new MemoryQueue(), mailer: new DisabledMailer(), origin: "https://app.example.test", programId: "test", mode: "test", checkReady: async () => { throw new Error("sensitive database failure details"); } });
  try { const response = await app.inject({ method: "GET", url: "/healthz" }); assert.equal(response.statusCode, 503); assert.ok(!response.body.includes("sensitive")); }
  finally { await app.close(); }
});
