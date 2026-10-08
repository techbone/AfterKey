import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomBytes } from "node:crypto";
import { ApiError, AuthService, digest, secretToken, walletAddress } from "./auth.js";
import type { Mailer, Queue, Store } from "./types.js";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "A JSON object is required.");
  return value as Record<string, unknown>;
}
function emailAddress(value: unknown): string {
  if (typeof value !== "string" || value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.trim())) throw new ApiError(400, "Enter a valid email address.");
  return value.trim().toLowerCase();
}

export async function createApp(options: { store: Store; queue: Queue; mailer: Mailer; origin: string; programId: string; mode: string; now?: () => Date; logger?: boolean }) {
  const now = options.now ?? (() => new Date());
  const secure = new URL(options.origin).protocol === "https:";
  const cookieName = secure ? "__Host-afterkey-session" : "afterkey-session";
  const auth = new AuthService(options.store, options.origin, options.programId, now);
  const app = Fastify({ bodyLimit: 8192, logger: options.logger ? { redact: ["req.headers.cookie", "req.headers.authorization"] } : false });
  await app.register(cookie);
  await app.register(cors, { origin: options.origin, credentials: true });
  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
  app.addHook("onRequest", async request => {
    if (["POST", "PATCH", "DELETE"].includes(request.method) && request.headers.origin !== options.origin) throw new ApiError(403, "Request origin is not allowed.");
  });
  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.code(error.status).send({ error: error.message });
    if (typeof error === "object" && error && "statusCode" in error && error.statusCode === 429) return reply.code(429).send({ error: "Too many requests. Try again later." });
    app.log.error({ code: "api_operation_failed" }, "API operation failed; sensitive details omitted");
    return reply.code(503).send({ error: "This operation is temporarily unavailable." });
  });
  app.get("/healthz", async () => ({ status: "ok", storage: options.mode, deliveryConfigured: options.mailer.enabled, network: "devnet", programId: options.programId }));
  app.post("/auth/nonce", async request => auth.challenge(walletAddress(object(request.body).wallet)));
  app.post("/auth/siws", async (request, reply) => {
    const body = object(request.body); const wallet = walletAddress(body.wallet);
    if (typeof body.nonce !== "string" || !/^[a-f0-9]{32}$/.test(body.nonce) || typeof body.signature !== "string") throw new ApiError(400, "Nonce and base64 signature are required.");
    const session = await auth.login(wallet, body.nonce, body.signature);
    reply.setCookie(cookieName, session.token, { path: "/", httpOnly: true, secure, sameSite: secure ? "none" : "lax", maxAge: 3600 });
    return { wallet, expiresAt: session.expiresAt.toISOString() };
  });
  app.get("/me", async request => options.store.getProfile(await auth.session(request.cookies[cookieName])));
  app.patch("/me", async request => {
    const wallet = await auth.session(request.cookies[cookieName]); const body = object(request.body);
    if (Object.keys(body).some(k => !["email", "enabled", "checkinReminders", "claimAlerts"].includes(k))) throw new ApiError(400, "Unknown preference field.");
    for (const key of ["enabled", "checkinReminders", "claimAlerts"]) if (body[key] !== undefined && typeof body[key] !== "boolean") throw new ApiError(400, "Preferences must be boolean values.");
    const previous = await options.store.getProfile(wallet);
    const email = body.email === undefined ? previous.email : emailAddress(body.email);
    const changed = email !== previous.email || (!!email && !previous.verifiedAt && body.email !== undefined);
    if ((changed || body.enabled === true) && !options.mailer.enabled) throw new ApiError(503, "Email delivery is not configured. No notification preferences were enabled.");
    if ((body.enabled === true || previous.enabled) && !email) throw new ApiError(400, "Add and verify an email address first.");
    if (changed && !(await options.store.claimEmailRate(digest(email!), now()))) throw new ApiError(429, "Verification was requested recently. Wait before requesting another email.");
    const profile = { ...previous, email, verifiedAt: changed ? null : previous.verifiedAt,
      enabled: body.enabled === undefined ? previous.enabled : body.enabled as boolean,
      checkinReminders: body.checkinReminders === undefined ? previous.checkinReminders : body.checkinReminders as boolean,
      claimAlerts: body.claimAlerts === undefined ? previous.claimAlerts : body.claimAlerts as boolean,
      version: !changed && !previous.verifiedAt ? previous.version : randomBytes(16).toString("hex") };
    await options.store.putProfile(profile);
    if (changed) {
      const token = secretToken(); const hash = digest(token);
      await options.store.putEmailToken({ hash, wallet, email: email!, version: profile.version, expiresAt: new Date(now().getTime() + 1_800_000) });
      await options.queue.enqueue({ key: digest(`verify:${hash}`), kind: "verify", wallet, version: profile.version, token }, now());
    }
    return profile;
  });
  app.post("/me/verify-email", async request => {
    const token = object(request.body).token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) || !(await options.store.verifyEmail(digest(token), now()))) throw new ApiError(400, "Verification link is invalid, expired, or already used.");
    return { verified: true };
  });
  app.delete("/me", async (request, reply) => {
    const wallet = await auth.session(request.cookies[cookieName]);
    await options.store.deleteUser(wallet);
    reply.clearCookie(cookieName, { path: "/", secure, sameSite: secure ? "none" : "lax" });
    return { removed: true };
  });
  return app;
}
