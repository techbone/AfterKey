import { PgBoss } from "pg-boss";
import type { EmailJob, Queue } from "./types.js";

const NAME = "afterkey-email";
export class PostgresQueue implements Queue {
  private boss: PgBoss;
  constructor(url: string) {
    this.boss = new PgBoss({ connectionString: url });
    this.boss.on("error", () => console.error("Notification queue error; inspect service health without exposing message payloads."));
  }
  async start() { await this.boss.start(); await this.boss.createQueue(NAME, { policy: "exclusive", retryLimit: 5, retryDelay: 30, retryBackoff: true }); }
  async enqueue(job: EmailJob, due: Date) { await this.boss.send(NAME, job, { singletonKey: job.key, startAfter: due }); }
  async work(handler: (job: EmailJob) => Promise<void>) { await this.boss.work<EmailJob>(NAME, { batchSize: 1, pollingIntervalSeconds: 2 }, async jobs => { for (const job of jobs) await handler(job.data); }); }
  async stop() { await this.boss.stop(); }
}
