import { createSignInMessageText } from "@solana/wallet-standard-util";

export interface NotificationProfile { wallet: string; email: string | null; verifiedAt: string | null; enabled: boolean; checkinReminders: boolean; claimAlerts: boolean; version: string }
export interface NotificationHealth { status: string; deliveryConfigured: boolean; network: string; programId: string }
export class SettingsError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function settingsRequest<T>(path: string, method = "GET", value?: object): Promise<T> {
  let response: Response;
  try { response = await fetch("/api/notifications" + path, { method, credentials: "same-origin", cache: "no-store", headers: value ? { "Content-Type": "application/json" } : undefined, body: value ? JSON.stringify(value) : undefined, signal: AbortSignal.timeout(20_000) }); }
  catch { throw new SettingsError("Email settings could not be reached. Try again shortly.", 503); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SettingsError(body && typeof body === "object" && typeof body.error === "string" ? body.error : "Email settings are temporarily unavailable.", response.status);
  return body as T;
}

/** Refuse signatures for a different wallet, site, network, program or purpose. */
export function settingsSignInMessage(value: unknown, wallet: string, origin: string, programId: string, now = Date.now()): { nonce: string; message: string } {
  const reject = () => { throw new SettingsError("The wallet sign-in request did not match this site. Please retry.", 400); };
  if (!value || typeof value !== "object") return reject();
  const challenge = value as Record<string, unknown>;
  if (!challenge.input || typeof challenge.input !== "object") return reject();
  const input = challenge.input as Record<string, unknown>;
  const statement = "Sign in to manage AfterKey email preferences. This does not authorize a vault transaction.";
  const resource = `urn:afterkey:devnet:${programId}:notifications`;
  if (input.address !== wallet || input.domain !== new URL(origin).host || input.uri !== origin + "/settings" || input.chainId !== "solana:devnet" || input.version !== "1" || input.statement !== statement || !Array.isArray(input.resources) || input.resources.length !== 1 || input.resources[0] !== resource || typeof challenge.nonce !== "string" || !/^[a-f0-9]{32}$/.test(challenge.nonce) || input.nonce !== challenge.nonce || typeof input.issuedAt !== "string" || typeof input.expirationTime !== "string") return reject();
  const issued = Date.parse(input.issuedAt); const expiry = Date.parse(input.expirationTime);
  if (!Number.isFinite(issued) || !Number.isFinite(expiry) || issued > now + 5000 || expiry <= now || expiry > now + 305000 || issued < now - 300000) return reject();
  const message = createSignInMessageText({ domain: new URL(origin).host, address: wallet, statement, uri: origin + "/settings", version: "1", chainId: "solana:devnet", nonce: challenge.nonce, issuedAt: input.issuedAt, expirationTime: input.expirationTime, resources: [resource] });
  if (challenge.message !== message) return reject();
  return { nonce: challenge.nonce, message };
}

export function notificationProfile(value: unknown, wallet: string): NotificationProfile {
  const profile = value as NotificationProfile | null;
  if (!profile || typeof profile !== "object" || profile.wallet !== wallet || ![profile.enabled, profile.checkinReminders, profile.claimAlerts].every(v => typeof v === "boolean") || (profile.email !== null && typeof profile.email !== "string") || (profile.verifiedAt !== null && typeof profile.verifiedAt !== "string")) throw new SettingsError("Sign in with the connected wallet to view its settings.", 401);
  return profile;
}
