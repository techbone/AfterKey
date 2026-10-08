import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { createSignInMessageText } from "@solana/wallet-standard-util";
import type { Store } from "./types.js";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const secretToken = () => randomBytes(32).toString("base64url");
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export function walletAddress(value: unknown): string {
  if (typeof value !== "string" || value.length > 44) throw new ApiError(400, "A public wallet address is required.");
  try {
    const key = new PublicKey(value);
    if (key.equals(PublicKey.default) || !PublicKey.isOnCurve(key.toBytes())) throw new Error();
    return key.toBase58();
  } catch { throw new ApiError(400, "Enter a valid signing wallet address."); }
}

export class AuthService {
  constructor(private store: Store, private origin: string, private programId: string, private now: () => Date) {}
  async challenge(wallet: string) {
    const id = randomBytes(16).toString("hex");
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + 300_000);
    const input = { domain: new URL(this.origin).host, address: wallet,
      statement: "Sign in to manage AfterKey email preferences. This does not authorize a vault transaction.",
      uri: `${this.origin}/settings`, version: "1", chainId: "solana:devnet", nonce: id,
      issuedAt: issuedAt.toISOString(), expirationTime: expiresAt.toISOString(),
      resources: [`urn:afterkey:devnet:${this.programId}:notifications`] };
    const message = createSignInMessageText(input);
    await this.store.putChallenge({ id, wallet, message, expiresAt });
    return { nonce: id, input, message, expiresAt: expiresAt.toISOString() };
  }
  async login(wallet: string, nonce: string, signature: string) {
    const challenge = await this.store.getChallenge(nonce);
    if (!challenge || challenge.wallet !== wallet || challenge.expiresAt <= this.now()) throw new ApiError(401, "The sign-in challenge is invalid or expired.");
    if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) throw new ApiError(401, "Invalid wallet signature.");
    const bytes = Buffer.from(signature, "base64");
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), new PublicKey(wallet).toBuffer()]), format: "der", type: "spki" });
    if (bytes.length !== 64 || !verify(null, Buffer.from(challenge.message), publicKey, bytes)) throw new ApiError(401, "Invalid wallet signature.");
    if (!(await this.store.consumeChallenge(nonce, this.now()))) throw new ApiError(401, "This sign-in challenge was already used.");
    const token = secretToken();
    const expiresAt = new Date(this.now().getTime() + 3_600_000);
    await this.store.putSession({ hash: digest(token), wallet, expiresAt });
    return { token, expiresAt };
  }
  async session(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, "Sign in with your wallet first.");
    const session = await this.store.getSession(digest(token));
    if (!session || session.expiresAt <= this.now()) throw new ApiError(401, "Your session expired. Sign in again.");
    return session.wallet;
  }
}
