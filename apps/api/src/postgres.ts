import { and, eq, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as tables from "./schema.js";
import { defaultProfile, type Challenge, type Delivery, type EmailToken, type Profile, type Session, type Store, type VaultSnapshot } from "./types.js";

export class PostgresStore implements Store {
  readonly pool: pg.Pool;
  readonly db: ReturnType<typeof drizzle<typeof tables>>;
  constructor(url: string) { this.pool = new pg.Pool({ connectionString: url, max: 5 }); this.db = drizzle(this.pool, { schema: tables }); }
  async ready() { await this.pool.query("select 1"); }
  async close() { await this.pool.end(); }
  async putChallenge(v: Challenge) {
    await this.db.delete(tables.challenges).where(lt(tables.challenges.expiresAt, new Date()));
    await this.db.insert(tables.challenges).values(v);
  }
  async getChallenge(id: string) { return (await this.db.select().from(tables.challenges).where(eq(tables.challenges.id, id)).limit(1))[0] ?? null; }
  async consumeChallenge(id: string, now: Date) { return (await this.db.delete(tables.challenges).where(and(eq(tables.challenges.id, id), gt(tables.challenges.expiresAt, now))).returning()).length === 1; }
  async putSession(v: Session) { await this.db.delete(tables.sessions).where(lt(tables.sessions.expiresAt, new Date())); await this.db.insert(tables.sessions).values(v); }
  async getSession(hash: string) { return (await this.db.select().from(tables.sessions).where(eq(tables.sessions.hash, hash)).limit(1))[0] ?? null; }
  async getProfile(wallet: string) { return (await this.db.select().from(tables.profiles).where(eq(tables.profiles.wallet, wallet)).limit(1))[0] ?? defaultProfile(wallet); }
  async putProfile(v: Profile) { await this.db.insert(tables.profiles).values(v).onConflictDoUpdate({ target: tables.profiles.wallet, set: v }); }
  async putEmailToken(v: EmailToken) { await this.db.delete(tables.emailTokens).where(lt(tables.emailTokens.expiresAt, new Date())); await this.db.insert(tables.emailTokens).values(v); }
  async getEmailToken(hash: string) { return (await this.db.select().from(tables.emailTokens).where(eq(tables.emailTokens.hash, hash)).limit(1))[0] ?? null; }
  async verifyEmail(hash: string, now: Date) {
    return this.db.transaction(async tx => {
      const [token] = await tx.delete(tables.emailTokens).where(and(eq(tables.emailTokens.hash, hash), gt(tables.emailTokens.expiresAt, now))).returning();
      if (!token) return false;
      const updated = await tx.update(tables.profiles).set({ verifiedAt: now }).where(and(eq(tables.profiles.wallet, token.wallet), eq(tables.profiles.email, token.email), eq(tables.profiles.version, token.version))).returning();
      return updated.length === 1;
    });
  }
  async deleteUser(wallet: string) { await this.db.transaction(async tx => { await tx.delete(tables.profiles).where(eq(tables.profiles.wallet, wallet)); await tx.delete(tables.sessions).where(eq(tables.sessions.wallet, wallet)); await tx.delete(tables.emailTokens).where(eq(tables.emailTokens.wallet, wallet)); }); }
  async claimEmailRate(key: string, now: Date) {
    const inserted = await this.db.insert(tables.emailRates).values({ key, lastRequest: now }).onConflictDoUpdate({ target: tables.emailRates.key, set: { lastRequest: now }, setWhere: lt(tables.emailRates.lastRequest, new Date(now.getTime() - 600_000)) }).returning();
    return inserted.length === 1;
  }
  async getDelivery(key: string) { const row = (await this.db.select().from(tables.deliveries).where(eq(tables.deliveries.key, key)).limit(1))[0]; return row ? { ...row, status: row.status as Delivery["status"] } : null; }
  async startDelivery(key: string, now: Date) { await this.db.insert(tables.deliveries).values({ key, firstAttemptAt: now, status: "sending" }).onConflictDoNothing(); return (await this.getDelivery(key))!; }
  async finishDelivery(key: string, status: Delivery["status"]) { await this.db.update(tables.deliveries).set({ status }).where(eq(tables.deliveries.key, key)); }
  async putVault(v: VaultSnapshot) { await this.db.insert(tables.vaults).values({ address: v.address, snapshot: v }).onConflictDoUpdate({ target: tables.vaults.address, set: { snapshot: v } }); }
  async getVault(address: string) { return (await this.db.select().from(tables.vaults).where(eq(tables.vaults.address, address)).limit(1))[0]?.snapshot ?? null; }
}
