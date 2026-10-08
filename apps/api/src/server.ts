import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { MemoryQueue, MemoryStore } from "./memory.js";
import { DisabledMailer, ResendMailer } from "./mailer.js";
import { NotificationEngine } from "./notifications.js";
import { PostgresQueue } from "./pg-queue.js";
import { PostgresStore } from "./postgres.js";
import { PROGRAM_ID, SolanaVaultSource } from "./solana.js";

async function main() {
  const config = readConfig(process.env);
  const now = () => new Date();
  const postgres = config.mode === "postgres" ? new PostgresStore(config.databaseUrl!) : null;
  const store = postgres ?? new MemoryStore();
  const queue = postgres ? new PostgresQueue(config.databaseUrl!) : new MemoryQueue();
  // Volatile local mode cannot accidentally send real email, even if keys are present.
  const mailer = config.deliveryEnabled && postgres && config.resendKey && config.resendFrom ? new ResendMailer(config.resendKey, config.resendFrom) : new DisabledMailer();
  const source = new SolanaVaultSource(config.rpc);
  const engine = new NotificationEngine(store, queue, source, mailer, config.origin, now);
  let timer: ReturnType<typeof setInterval> | undefined;
  const cleanup = async () => {
    if (timer) clearInterval(timer);
    try { await queue.stop(); } finally { await postgres?.close(); }
  };
  try {
    if (postgres) await postgres.ready();
    if (queue instanceof PostgresQueue) await queue.start();
    let busy = false;
    const sync = async () => {
      if (busy) return; busy = true;
      try { const result = await engine.reconcile(); if (result.corrected) console.log(JSON.stringify({ event: "projection_reconciled", corrected: result.corrected })); }
      catch { console.error("Notification reconciliation failed; on-chain actions remain independent."); }
      finally { busy = false; }
    };
    if (postgres && mailer.enabled) { await source.ready(); await engine.start(); await sync(); timer = setInterval(() => void sync(), config.interval * 1000); }
    const app = await createApp({ store, queue, mailer, origin: config.origin, programId: PROGRAM_ID, mode: config.mode, logger: true });
    app.addHook("onClose", cleanup);
    await app.listen({ port: config.port, host: config.host });
    const shutdown = () => { void app.close(); };
    process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
  } catch (error) {
    await cleanup();
    throw error;
  }
}
main().catch(() => { console.error("Backend startup failed. Check local storage/provider configuration; secret values are not logged."); process.exitCode = 1; });
