import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { databaseUrl } from "./database-url.js";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const pool = new pg.Pool({ connectionString: databaseUrl(process.env.DATABASE_URL), max: 1, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  try { await pool.query(readFileSync(join(import.meta.dirname, "../migrations/001_notifications.sql"), "utf8")); console.log("Notification schema migration completed."); }
  finally { await pool.end(); }
}
main().catch(() => { console.error("Migration failed. Check the database connection without sharing credentials."); process.exitCode = 1; });
