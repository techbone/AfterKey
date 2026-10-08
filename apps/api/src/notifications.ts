import { digest } from "./auth.js";
import type { EmailJob, Mailer, Queue, Store, VaultSource } from "./types.js";

/** Read-only reconciliation and delivery. No transaction-signing capability. */
export class NotificationEngine {
  constructor(private store: Store, private queue: Queue, private source: VaultSource,
    private mailer: Mailer, private origin: string, private now: () => Date) {}

  async reconcile() {
    const now = this.now();
    const snapshots = await this.source.list();
    let corrected = 0;
    for (const vault of snapshots) {
      const old = await this.store.getVault(vault.address);
      const fingerprint = (v: typeof vault) => JSON.stringify([v.owner, v.state, v.lastCheckin, v.inactivitySeconds, v.claimInitiatedAt, v.challengeSeconds]);
      if (old && fingerprint(old) !== fingerprint(vault)) corrected++;
      await this.store.putVault(vault);
      const profile = await this.store.getProfile(vault.owner);
      if (!profile.enabled || !profile.email || !profile.verifiedAt) continue;
      const common = { wallet: vault.owner, version: profile.version, vault: vault.address };
      if (vault.state === "active" && profile.checkinReminders) {
        const deadline = (vault.lastCheckin + vault.inactivitySeconds) * 1000;
        if (deadline <= now.getTime()) continue;
        for (const phase of [50, 80, 95]) {
          const key = digest(`reminder:${vault.address}:${vault.lastCheckin}:${phase}:${profile.version}`);
          if (await this.store.getDelivery(key)) continue;
          await this.queue.enqueue({ ...common, key, kind: "reminder", phase, lastCheckin: vault.lastCheckin },
            new Date((vault.lastCheckin + Math.floor(vault.inactivitySeconds * phase / 100)) * 1000));
        }
      }
      if (vault.state === "inChallenge" && profile.claimAlerts) {
        const key = digest(`claim:${vault.address}:${vault.claimInitiatedAt}:${profile.version}`);
        if (!(await this.store.getDelivery(key))) await this.queue.enqueue({ ...common, key, kind: "claim", claimInitiatedAt: vault.claimInitiatedAt }, now);
      }
    }
    return { scanned: snapshots.length, corrected };
  }

  async deliver(job: EmailJob) {
    const now = this.now();
    const existing = await this.store.getDelivery(job.key);
    if (existing && existing.status !== "sending") return;
    const profile = await this.store.getProfile(job.wallet);
    let subject: string;
    let text: string;
    let eligible = profile.email !== null && profile.version === job.version;
    if (job.kind === "verify") {
      const token = job.token ? await this.store.getEmailToken(digest(job.token)) : null;
      eligible = eligible && !!token && token!.expiresAt > now && token!.wallet === profile.wallet && token!.email === profile.email && token!.version === profile.version;
      subject = "Verify your AfterKey reminder email";
      text = `Verify this email for the wallet ${profile.wallet}:\n${this.origin}/settings#verify=${encodeURIComponent(job.token ?? "")}\n\nThis only enables email preferences. It does not authorize a vault transaction. If you did not request this, ignore it.`;
    } else {
      eligible = eligible && profile.enabled && profile.verifiedAt !== null;
      // Always read the current chain state before sending; projections are rebuildable caches.
      const vault = eligible && job.vault ? await this.source.get(job.vault) : null;
      eligible = eligible && vault !== null && vault!.owner === profile.wallet;
      if (job.kind === "reminder") {
        eligible = eligible && profile.checkinReminders && vault!.state === "active" && vault!.lastCheckin === job.lastCheckin
          && now.getTime() < (vault!.lastCheckin + vault!.inactivitySeconds) * 1000;
        subject = "Your AfterKey check-in reminder";
        const deadline = vault ? new Date((vault.lastCheckin + vault.inactivitySeconds) * 1000).toISOString() : "";
        text = `Your devnet vault ${job.vault} is ${job.phase}% through its inactivity period. Its current check-in deadline is ${deadline}.\nOpen ${this.origin}/app and check in with your wallet. AfterKey does not need your seed phrase. Email delivery is a courtesy; the on-chain rules remain authoritative.`;
      } else {
        eligible = eligible && profile.claimAlerts && vault!.state === "inChallenge" && vault!.claimInitiatedAt === job.claimInitiatedAt;
        subject = "A claim has started on your AfterKey vault";
        const end = vault ? new Date((vault.claimInitiatedAt + vault.challengeSeconds) * 1000).toISOString() : "";
        text = `A claim started on your devnet vault ${job.vault}. The challenge deadline is ${end}.\nOpen ${this.origin}/app to inspect the claim and respond with your wallet before release. This email cannot cancel or approve the claim, and AfterKey never asks for your seed phrase.`;
      }
    }
    const delivery = await this.store.startDelivery(job.key, now);
    if (!eligible) { await this.store.finishDelivery(job.key, "skipped"); return; }
    // Resend retains idempotency keys for 24h. Avoid uncertain re-delivery outside that window.
    if (now.getTime() - delivery.firstAttemptAt.getTime() >= 23 * 3_600_000) { await this.store.finishDelivery(job.key, "expired"); return; }
    if (!this.mailer.enabled) throw new Error("Email delivery is not configured.");
    await this.mailer.send({ to: profile.email!, subject, text, key: job.key });
    await this.store.finishDelivery(job.key, "sent");
  }
  async start() { await this.queue.work(job => this.deliver(job)); }
}
