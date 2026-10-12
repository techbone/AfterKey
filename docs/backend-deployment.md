# Deploy the notification API

The frontend remains on Vercel. The API needs a persistent process for pg-boss and reconciliation; deploy one instance using the root build context and `apps/api/Dockerfile`. Database credentials and the Resend API key are server secrets. `.dockerignore` excludes local environment files and deployment keys.

## Prepared targets

- Fly.io: `apps/api/fly.toml`, Frankfurt to match the configured Supabase region; one 512 MB instance, HTTPS, health checks, no automatic stopping.
- Railway: `apps/api/railway.toml`; select that config file in the service settings, keep repository root as build context, use `apps/api/Dockerfile`. `PORT` is supported. Use a persistent paid service suitable for background jobs.

These files are prepared, not evidence of a public deployment. The Docker engine was unavailable for a local image build during this milestone. The Node API and frontend proxy were tested directly. A hosted build, startup and health check are still required. Obtain founder approval before creating a paid service; do not add another managed database.

## Private settings

Required: `DATABASE_URL`, `FRONTEND_ORIGIN=https://after-key-web.vercel.app`, `API_STORAGE=postgres`, `NODE_ENV=production`, `API_HOST=0.0.0.0`. Set `API_PORT=8080` on Fly; let Railway provide `PORT` unless explicitly configured.

The API now resolves the bundled Supabase CA on its own host and forces `verify-full` for Supabase URLs. A Mac-specific certificate path in the saved URI is replaced at runtime. Credentials are preserved and never logged.

Keep `NOTIFICATIONS_DELIVERY_ENABLED=false` for first deployment. Once ready, add `RESEND_API_KEY` and `RESEND_FROM="AfterKey <alerts@YOUR_VERIFIED_DOMAIN>"` as hosting secrets. Both must be configured together. Prefer an email-sending key restricted to that domain; do not place it in Vercel public variables.

## Connect Vercel to the API

Set the **server-only** Vercel variable `AFTERKEY_API_URL` to the HTTPS origin of the hosted API and redeploy the frontend. Do not use a `NEXT_PUBLIC_` prefix. Browser requests go through `/api/notifications`; only fixed settings routes and settings session cookies are forwarded. Session cookies remain on the frontend origin, avoiding third-party-cookie dependence.

The frontend and API must use the same canonical frontend origin. Preview domains are not authorized for production sign-in. `/settings` explicitly shows unavailable delivery when the API is absent or delivery is disabled.

## Activation and acceptance

1. Verify the hosted `/healthz` responds with PostgreSQL storage, the current devnet program and delivery disabled. Check again after a service restart.
2. Test wallet sign-in through the live frontend and confirm wallet switching does not reveal another wallet's email preferences.
3. With the founder's explicit opt-in, turn delivery on, request mailbox verification and confirm the link through Settings. This is a real email test, not a mock-provider result.
4. Run the compressed devnet reminder/claim/veto/closure walkthrough and retain receipts. Check-in/veto must suppress stale queued emails. Delivery downtime must not block wallet actions.
5. Check disable, sign-out, expired-session recovery and removal of settings. Configure an uptime check for `/healthz`; it now fails when storage is unavailable or active reconciliation is stale. Monitor queue errors/failed jobs; health alone does not prove provider delivery.

No real email was sent while preparing this milestone. If domain verification or hosting cannot finish before submission, demonstrate the working core and state the notification activation limit honestly.
