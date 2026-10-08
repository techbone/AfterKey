import { defaultProfile, type Challenge, type Delivery, type EmailJob, type EmailToken, type Profile, type Queue, type Session, type Store, type VaultSnapshot } from "./types.js";

/** Explicit local/test adapter. Production bootstrap refuses this store. */
export class MemoryStore implements Store {
  challenges = new Map<string, Challenge>(); sessions = new Map<string, Session>(); profiles = new Map<string, Profile>();
  tokens = new Map<string, EmailToken>(); deliveries = new Map<string, Delivery>(); vaults = new Map<string, VaultSnapshot>(); rates = new Map<string, number>();
  async putChallenge(v: Challenge) { this.challenges.set(v.id, structuredClone(v)); }
  async getChallenge(id: string) { return structuredClone(this.challenges.get(id) ?? null); }
  async consumeChallenge(id: string, now: Date) { const value = this.challenges.get(id); if (!value || value.expiresAt <= now) return false; this.challenges.delete(id); return true; }
  async putSession(v: Session) { this.sessions.set(v.hash, structuredClone(v)); }
  async getSession(hash: string) { return structuredClone(this.sessions.get(hash) ?? null); }
  async getProfile(wallet: string) { return structuredClone(this.profiles.get(wallet) ?? defaultProfile(wallet)); }
  async putProfile(v: Profile) { this.profiles.set(v.wallet, structuredClone(v)); }
  async putEmailToken(v: EmailToken) { this.tokens.set(v.hash, structuredClone(v)); }
  async getEmailToken(hash: string) { return structuredClone(this.tokens.get(hash) ?? null); }
  async verifyEmail(hash: string, now: Date) {
    const token = this.tokens.get(hash); if (!token || token.expiresAt <= now) return false;
    this.tokens.delete(hash);
    const profile = this.profiles.get(token.wallet);
    if (!profile || profile.email !== token.email || profile.version !== token.version) return false;
    profile.verifiedAt = now; return true;
  }
  async deleteUser(wallet: string) {
    this.profiles.delete(wallet);
    for (const [key, value] of this.sessions) if (value.wallet === wallet) this.sessions.delete(key);
    for (const [key, value] of this.tokens) if (value.wallet === wallet) this.tokens.delete(key);
  }
  async claimEmailRate(key: string, now: Date) { if (now.getTime() - (this.rates.get(key) ?? -Infinity) < 600_000) return false; this.rates.set(key, now.getTime()); return true; }
  async getDelivery(key: string) { return structuredClone(this.deliveries.get(key) ?? null); }
  async startDelivery(key: string, now: Date) { if (!this.deliveries.has(key)) this.deliveries.set(key, { key, firstAttemptAt: now, status: "sending" }); return structuredClone(this.deliveries.get(key)!); }
  async finishDelivery(key: string, status: Delivery["status"]) { const row = this.deliveries.get(key); if (row) row.status = status; }
  async putVault(v: VaultSnapshot) { this.vaults.set(v.address, structuredClone(v)); }
  async getVault(address: string) { return structuredClone(this.vaults.get(address) ?? null); }
}

export class MemoryQueue implements Queue {
  jobs = new Map<string, { job: EmailJob; due: Date; attempts: number }>();
  handler?: (job: EmailJob) => Promise<void>;
  async enqueue(job: EmailJob, due: Date) { if (!this.jobs.has(job.key)) this.jobs.set(job.key, { job: structuredClone(job), due, attempts: 0 }); }
  async work(handler: (job: EmailJob) => Promise<void>) { this.handler = handler; }
  async stop() { this.handler = undefined; }
  async runDue(now: Date) {
    if (!this.handler) throw new Error("Test queue has no worker.");
    for (const [key, item] of this.jobs) {
      if (item.due > now) continue;
      try { await this.handler(item.job); this.jobs.delete(key); }
      catch { item.attempts++; if (item.attempts > 5) this.jobs.delete(key); else item.due = new Date(now.getTime() + 30_000 * 2 ** (item.attempts - 1)); }
    }
  }
}
