import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { VaultSnapshot } from "./types.js";

export const challenges = pgTable("afterkey_auth_challenges", { id: text().primaryKey(), wallet: text().notNull(), message: text().notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull() }).enableRLS();
export const sessions = pgTable("afterkey_sessions", { hash: text().primaryKey(), wallet: text().notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull() }).enableRLS();
export const profiles = pgTable("afterkey_profiles", {
  wallet: text().primaryKey(), email: text(), verifiedAt: timestamp("verified_at", { withTimezone: true }), enabled: boolean().notNull(),
  checkinReminders: boolean("checkin_reminders").notNull(), claimAlerts: boolean("claim_alerts").notNull(), version: text().notNull()
}).enableRLS();
export const emailTokens = pgTable("afterkey_email_tokens", { hash: text().primaryKey(), wallet: text().notNull(), email: text().notNull(), version: text().notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull() }).enableRLS();
export const emailRates = pgTable("afterkey_email_rates", { key: text().primaryKey(), lastRequest: timestamp("last_request", { withTimezone: true }).notNull() }).enableRLS();
export const deliveries = pgTable("afterkey_deliveries", { key: text().primaryKey(), firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }).notNull(), status: text().notNull() }).enableRLS();
export const vaults = pgTable("afterkey_vault_snapshots", { address: text().primaryKey(), snapshot: jsonb().$type<VaultSnapshot>().notNull() }).enableRLS();
