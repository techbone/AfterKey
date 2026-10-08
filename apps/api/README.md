# Prepared notification backend

Node **22.12+**, Fastify, PostgreSQL/Drizzle, pg-boss and a Resend transport. This first slice binds an optional email to a signing wallet, verifies email ownership, schedules 50/80/95% check-in reminders, and alerts the owner when a claim starts. It reads Solana; it has no wallet key and cannot move vault funds.

**Status:** code and local API/worker tests are prepared. Real delivery is disabled by default. PostgreSQL/pg-boss integration, real provider delivery, public hosting and the frontend Settings/verification page remain deployment gates. The existing frontend still states that notifications are unavailable. No real emails were sent during preparation.

## Local preparation

```sh
npm ci
cp apps/api/.env.example apps/api/.env
npm run start:api
```

The example explicitly chooses memory storage and disabled delivery. Open `http://127.0.0.1:8080/healthz`; it must show `storage: memory` and `deliveryConfigured: false`. This mode loses state on restart and is rejected in production. Even when email credentials exist, memory mode cannot enable real delivery. API requests to enable email return an explicit unavailable error.

```sh
npm run test:api
npm run typecheck
```

Tests use generated test wallets, in-memory storage/queues, fake chain snapshots and a mock email provider. They cover signatures, replay/expiry, CSRF, session cookies, one-use email verification, preference changes, stale reminders/claim alerts, retry idempotency, data deletion, projection repair and disabled-delivery guards. They do not prove live PostgreSQL or inbox delivery.

Two database integration tests are opt-in locally and enabled in CI. They require a disposable localhost database whose name ends in `_test`; never point them at application data. They rerun the migration and test persistence, concurrent one-use operations, RLS configuration and queue failure/retry across restart. For an already running test database:

```sh
AFTERKEY_TEST_DATABASE_URL=postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/afterkey_test npm run test:api
```

## API contract

| Route | Purpose |
| --- | --- |
| `POST /auth/nonce` | `{ wallet }` → single-use, five-minute SIWS input and exact message |
| `POST /auth/siws` | `{ wallet, nonce, signature }`, signature = base64 Ed25519 signature of that exact message; sets a one-hour HttpOnly session cookie |
| `GET /me` | Authenticated wallet's email and preferences |
| `PATCH /me` | Optional `email`, `enabled`, `checkinReminders`, `claimAlerts`; signed session required |
| `POST /me/verify-email` | `{ token }`; proves mailbox access and consumes the verification token |
| `DELETE /me` | Deletes email preferences, pending verification records and sessions |
| `GET /healthz` | Storage mode, delivery configuration and devnet program ID |

State-changing requests require an `Origin` matching `FRONTEND_ORIGIN`. The browser sends cookies with `credentials: include`; CORS allows only the configured frontend origin. HTTPS uses a Secure, HttpOnly, SameSite=None host cookie; local HTTP uses SameSite=Lax. Session tokens and email-verification lookup records are stored hashed. Pending verification jobs contain the raw token needed to compose the email, so queue payloads must remain private and must not be logged. A verification link carries its token in a URL fragment, not a query string; the future Settings page must consume it through the POST endpoint and clear the fragment. Do not put token values or email addresses in access logs.

The sign-in message is built with the official wallet-standard utility and bound to the frontend domain, address, nonce, expiration, devnet and current program. It grants email-preference access, not transaction authority. Rate limits apply to API requests and verification requests per recipient.

## Durable setup and activation

Keep real credentials in `apps/api/.env` locally or hosting secrets. Never use `NEXT_PUBLIC_` variables for them and never paste them in chat.

Required settings:

```dotenv
API_STORAGE=postgres
NODE_ENV=production
DATABASE_URL=postgresql://REPLACE_WITH_PRIVATE_BACKEND_CONNECTION
FRONTEND_ORIGIN=https://after-key-web.vercel.app
API_HOST=0.0.0.0
API_PORT=8080
RESEND_API_KEY=REPLACE_IN_PRIVATE_ENV_ONLY
RESEND_FROM="AfterKey <alerts@YOUR_VERIFIED_DOMAIN>"
SOLANA_RPC_URL=https://api.devnet.solana.com
POLL_INTERVAL_SECONDS=30
NOTIFICATIONS_DELIVERY_ENABLED=false
```

Use a private owner/service-role PostgreSQL connection with appropriate TLS settings. Migrations enable row-level security without browser/client policies for all private tables. Do not expose the pg-boss schema through a public data API. The backend is the only intended database client.

```sh
npm run migrate:api
npm run start:api
```

Before switching delivery on:

1. Run the migration against the configured database and verify persistence across restart, concurrent nonce consumption and pg-boss retries.
2. Finish the frontend Settings flow, email fragment verification and unsubscribe controls. `/settings` is not implemented by this slice; sending links before that page exists would be unusable.
3. Configure Resend's verified sender domain and a backend host. Test delivery to the founder's explicitly opted-in address and retain the receipt.
4. Run a compressed devnet reminder/claim/veto/closure walkthrough. Confirm reminders are superseded after check-in, alerts stop after veto/closure, and notification downtime does not block vault actions. Measure claim-alert delivery against the five-minute target.
5. Add queue-failure and stale-reconciliation monitoring before calling the service reliable.
6. Then set `NOTIFICATIONS_DELIVERY_ENABLED=true`. Keys alone do not activate delivery.

The worker queues stable logical keys, retries failed deliveries with the same provider idempotency key and records completion durably. Resend's idempotency window is [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); uncertain attempts older than 23 hours are marked expired rather than blindly re-sent. Every reminder/claim email rechecks current chain state, verified opt-in and preference version. Cached projections are replaced from the authoritative snapshot.

This slice uses direct polling/reconciliation with a default 30-second interval. Helius webhooks/event backfill, beneficiary-change tripwires, courtesy cranking, full indexed activity APIs and paging are later parts of the existing backend architecture. No backend key is required by the current owner or heir browser flows.
