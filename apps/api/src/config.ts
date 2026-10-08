export function readConfig(env: NodeJS.ProcessEnv) {
  const mode = env.API_STORAGE ?? "postgres";
  if (!["memory", "postgres"].includes(mode)) throw new Error("API_STORAGE must be postgres or memory.");
  if (mode === "memory" && env.NODE_ENV === "production") throw new Error("Production cannot use volatile memory storage.");
  if (mode === "postgres" && !env.DATABASE_URL) throw new Error("DATABASE_URL is required. Use API_STORAGE=memory only for local preparation.");
  const origin = new URL(env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3101");
  if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("FRONTEND_ORIGIN must contain only the frontend origin.");
  if (env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("Production requires an HTTPS frontend origin.");
  const port = Number(env.API_PORT ?? "8080"); const interval = Number(env.POLL_INTERVAL_SECONDS ?? "30");
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(interval) || interval < 10 || interval > 60) throw new Error("Invalid API_PORT or POLL_INTERVAL_SECONDS.");
  if (!!env.RESEND_API_KEY !== !!env.RESEND_FROM) throw new Error("Configure both RESEND_API_KEY and RESEND_FROM, or leave both unset.");
  const deliveryEnabled = env.NOTIFICATIONS_DELIVERY_ENABLED === "true";
  if (deliveryEnabled && (mode !== "postgres" || !env.RESEND_API_KEY || !env.RESEND_FROM)) throw new Error("Real email delivery requires durable storage and complete provider configuration.");
  return { mode, origin: origin.origin, port, interval, host: env.API_HOST ?? "127.0.0.1", databaseUrl: env.DATABASE_URL,
    rpc: env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", resendKey: env.RESEND_API_KEY, resendFrom: env.RESEND_FROM, deliveryEnabled };
}
