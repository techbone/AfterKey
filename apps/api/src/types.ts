export interface Challenge { id: string; wallet: string; message: string; expiresAt: Date }
export interface Session { hash: string; wallet: string; expiresAt: Date }
export interface Profile {
  wallet: string; email: string | null; verifiedAt: Date | null; enabled: boolean;
  checkinReminders: boolean; claimAlerts: boolean; version: string;
}
export interface EmailToken { hash: string; wallet: string; email: string; version: string; expiresAt: Date }
export interface VaultSnapshot {
  address: string; owner: string; state: "active" | "inChallenge" | "released" | "closed";
  lastCheckin: number; inactivitySeconds: number; claimInitiatedAt: number; challengeSeconds: number;
}
export interface Delivery { key: string; firstAttemptAt: Date; status: "sending" | "sent" | "skipped" | "expired" }
export interface Store {
  putChallenge(value: Challenge): Promise<void>; getChallenge(id: string): Promise<Challenge | null>;
  consumeChallenge(id: string, now: Date): Promise<boolean>;
  putSession(value: Session): Promise<void>; getSession(hash: string): Promise<Session | null>;
  getProfile(wallet: string): Promise<Profile>; putProfile(value: Profile): Promise<void>;
  putEmailToken(value: EmailToken): Promise<void>; getEmailToken(hash: string): Promise<EmailToken | null>;
  verifyEmail(hash: string, now: Date): Promise<boolean>; deleteUser(wallet: string): Promise<void>;
  claimEmailRate(key: string, now: Date): Promise<boolean>;
  getDelivery(key: string): Promise<Delivery | null>; startDelivery(key: string, now: Date): Promise<Delivery>;
  finishDelivery(key: string, status: Delivery["status"]): Promise<void>;
  putVault(value: VaultSnapshot): Promise<void>; getVault(address: string): Promise<VaultSnapshot | null>;
}
export type EmailJob = {
  key: string; kind: "verify" | "reminder" | "claim"; wallet: string; version: string;
  vault?: string; lastCheckin?: number; phase?: number; claimInitiatedAt?: number; token?: string;
};
export interface Queue {
  enqueue(job: EmailJob, due: Date): Promise<void>;
  work(handler: (job: EmailJob) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
export interface Mail { to: string; subject: string; text: string; key: string }
export interface Mailer { enabled: boolean; send(mail: Mail): Promise<void> }
export interface VaultSource { list(): Promise<VaultSnapshot[]>; get(address: string): Promise<VaultSnapshot | null> }
export const defaultProfile = (wallet: string): Profile => ({ wallet, email: null, verifiedAt: null, enabled: false, checkinReminders: true, claimAlerts: true, version: "initial" });
