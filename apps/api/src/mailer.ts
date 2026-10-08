import type { Mail, Mailer } from "./types.js";

export class DisabledMailer implements Mailer {
  enabled = false;
  async send(_mail: Mail): Promise<void> { throw new Error("Email delivery is not configured."); }
}
export class ResendMailer implements Mailer {
  enabled = true;
  constructor(private key: string, private from: string) {}
  async send(mail: Mail) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": `afterkey/${mail.key}` },
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text }), signal: AbortSignal.timeout(15_000) });
    // Do not log response bodies: they may include recipient details.
    if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}.`);
  }
}
