# System Architecture — AfterKey

## 1. Architecture at a glance

```
                        ┌────────────────────────────────────────┐
                        │              Solana Mainnet            │
                        │  ┌──────────────────────────────────┐  │
                        │  │   proof_of_life (Anchor program) │  │
                        │  │  Vault PDAs · token accounts ·   │  │
                        │  │  events (Anchor CPI/log events)  │  │
                        │  └──────────────────────────────────┘  │
                        └───────▲───────────────────┬────────────┘
                                │ tx (wallet-signed)│ webhooks (Helius)
                                │                   ▼
┌───────────────┐   RPC reads  ┌┴──────────┐   ┌─────────────────────────┐
│  Next.js app  │◄────────────►│  Wallet    │   │  Backend (Fastify)      │
│  (Vercel)     │              │  Adapter   │   │  indexer · notifications│
│               │──REST (opt)──────────────────►│  Postgres · pg-boss     │
└───────────────┘   email prefs, indexed reads  │  Resend (email)         │
                                                └─────────────────────────┘
```

**Load-bearing principle:** the Solana program is the entire trust surface. The backend and frontend are conveniences — if both vanish, every vault still works via CLI/explorer. This shapes every decision below.

## 2. Components and responsibilities

| Component | Trust level | Responsibilities | Must NOT do |
|---|---|---|---|
| Anchor program | Trustless (audited code + upgrade authority) | Custody, timing, state machine, distribution | Depend on any off-chain signer for correctness |
| Frontend | Untrusted convenience | Wallet UX, tx building, chain reads, claim wizard | Hold keys, gate any protocol action |
| Backend | Untrusted convenience | Index events, schedule/send notifications, serve fast reads, run the finalize/distribute cranker | Be required for any funds movement; custody anything |
| Helius | Untrusted data source | Webhook push of program transactions | Be the only source of truth (frontend always verifies against RPC for money-relevant views) |

## 3. Data flow — the four critical paths

### 3.1 Check-in (happy path, weekly/monthly)
Wallet signs `check_in` → program sets `last_checkin = clock.unix_timestamp` → event → Helius webhook → backend updates `vaults.last_checkin_at`, reschedules reminder jobs.

### 3.2 Reminder escalation (owner going quiet)
pg-boss scheduled jobs at 50/80/95% of the inactivity period fire → Resend email ("check in or your vault becomes claimable on <date>"). Jobs are recomputed on every indexed check-in. Missing this path never releases funds early — it only fails to prevent a *claimable* state, which the challenge window still guards.

### 3.3 Claim + challenge (the product moment)
Beneficiary signs `initiate_claim` (program verifies `now > last_checkin + inactivity_period`) → state `InChallenge`, event → backend blasts owner on all registered channels, weekly re-alerts → either owner signs `veto_claim` (state back to `Active`) or window elapses → anyone signs `finalize_claim` → state `Released` → per-mint `distribute` moves `share_bps/10000` of each holding to beneficiary ATAs → `Closed`.

### 3.4 Cranker (permissionless completion)
A backend cron attempts `finalize_claim` + `distribute` for any vault past its window. Because these instructions are permissionless, anyone else can run the same crank — the backend is an operator of convenience, not a privileged actor.

## 4. Why each major choice

- **Anchor over raw Solana programs:** account validation macros eliminate the largest class of Solana exploits (missing owner/signer checks); IDL gives the frontend a typed client for free; the audit ecosystem knows Anchor. The runtime overhead is irrelevant at our throughput. See smart-contracts.md.
- **Backend: yes, but thin.** A dead-man's switch without reminders is a foot-gun — notifications are a product requirement (preventing false release), not a nicety. But it must stay off the trust path. Fastify (fast, minimal, TS-native), Postgres via Supabase (managed, free tier, row-level security if we ever expose it directly), pg-boss for jobs (queues inside Postgres — one datastore, no Redis to operate; swap for BullMQ+Redis only if job volume demands it), Helius webhooks for indexing (no Geyser plugin to run at our scale). See backend.md.
- **Frontend: Next.js over Vite.** We need a marketing site + SEO content ("crypto inheritance") and an app in one deploy; App Router + Vercel gives that with zero infra. Wallet-adapter is the ecosystem standard. TanStack Query fits the "chain is the source of truth, poll and cache" model. See frontend.md.
- **Helius over self-hosted indexing:** webhook delivery + enhanced tx parsing for ~$0–50/mo versus running Geyser/validator infra. Replaceable later; the events table is designed so a re-index from any RPC provider can rebuild state.

## 5. Environments

| Env | Chain | Frontend | Backend | Purpose |
|---|---|---|---|---|
| local | solana-test-validator | localhost | localhost + local Postgres | Anchor tests, fast iteration |
| staging | devnet | Vercel preview | Fly.io/Railway staging | Beta testing, compressed timers allowed (min periods relaxed via feature flag in program constraints? **No** — same binary; devnet deploy uses a build-time `cfg` for short minimums) |
| prod | mainnet-beta | Vercel prod | Fly.io/Railway prod | Real funds |

Note: the devnet build relaxes minimum periods via a Cargo feature (`devnet-timing`) so end-to-end inheritance can be demoed in minutes. The mainnet artifact is always built without it; CI asserts this.

## 6. What is deliberately absent

- No microservices — one backend service, one program, one web app.
- No Redis, no Kafka, no GraphQL — Postgres and REST cover MVP volumes by orders of magnitude.
- No admin dashboard — Supabase Studio + SQL is the admin dashboard until beta.
- No custom RPC infra — Helius standard endpoints; upgrade tier when rate limits bite.

## 7. Scaling story (when it matters)

10k vaults ≈ 10k rows and a few hundred events/day — trivially fine. First real pressure points, in order: RPC rate limits on the dashboard (fix: backend-served indexed reads become the default with RPC verification only at tx time), email volume (fix: Resend paid tier), job fan-out (fix: BullMQ + Redis). The program itself has no scaling cliff: every vault is an independent account, no global state contention except the config PDA which is read-only in hot paths.
