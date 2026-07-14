# Backend Architecture — AfterKey

## 1. Do we need a backend? Yes — but only for what the chain can't do

The chain cannot email a user "you have 14 days to prove you're alive." For a dead-man's switch, **notifications are safety-critical product surface** (they prevent false releases), even though they are never *trust*-critical (they can't move funds). The backend also gives the frontend fast indexed reads and runs the courtesy cranker.

Hard rule from architecture.md: every funds-moving flow works with the backend completely offline.

## 2. Stack & why

| Concern | Choice | Why (and why not alternatives) |
|---|---|---|
| Runtime/framework | **Node 22 + TypeScript + Fastify** | Same language as frontend/tooling; Fastify = minimal, fast, first-class TS + JSON-schema validation. NestJS rejected: DI ceremony for a service with ~10 routes. |
| Database | **Postgres (Supabase managed)** | Relational fits vault/beneficiary/notification data exactly; Supabase = zero-ops, free tier through beta, built-in auth we can ignore or adopt. |
| Jobs/queue | **pg-boss** | Cron + delayed jobs + retries inside Postgres — one datastore, no Redis to run. Our volume (thousands of jobs/day at 10k vaults) is ~1000× below pg-boss limits. Swap to BullMQ+Redis only if that changes. |
| Chain indexing | **Helius webhooks** (enhanced tx, filtered to our program) | Push > poll; no Geyser infra; ~free at our volume. Backfill/verify via `getSignaturesForAddress` on startup and hourly reconciliation, so Helius is not a single point of truth. |
| Email | **Resend** | Modern API, React-email templates, good deliverability defaults; DKIM/DMARC required (see security.md §3.6 — email is a phishing surface). |
| Hosting | **Fly.io or Railway** (single small instance + Postgres) | One container, cheap, easy cron; no k8s. |
| Monitoring | **Sentry** (errors) + **Better Stack** (uptime + log alerts) + pg-boss job-failure alerts → founder's phone | The pager matters: a silently dead reminder pipeline is our worst operational failure (see §6). |

## 3. Service layout (one deployable)

```
apps/api/
  src/
    server.ts            # Fastify bootstrap
    routes/              # auth, me, vaults, webhooks, health
    indexer/             # webhook handler + reconciler → events table → projections
    jobs/                # pg-boss workers: reminders, claim-alerts, cranker, reconcile
    notifications/       # template rendering + Resend client + prefs logic
    solana/              # RPC client, tx builder for crank ixs, program IDL bindings
    db/                  # drizzle schema + migrations
```

Drizzle ORM (typed, SQL-first, no magic). One process runs both HTTP and workers at MVP scale; split later if needed.

## 4. Database schema

```sql
-- People (only exists if user opts into notifications)
users (
  wallet          text primary key,          -- base58 pubkey
  email           text,
  email_verified_at timestamptz,
  notify_checkin_reminders boolean default true,
  notify_claims   boolean default true,
  created_at      timestamptz default now()
)

-- Projection of on-chain vaults (rebuildable from events)
vaults (
  address         text primary key,          -- vault PDA
  owner           text not null,
  vault_id        bigint not null,
  state           text not null,             -- Active|InChallenge|Released|Closed
  inactivity_secs bigint not null,
  challenge_secs  bigint not null,
  last_checkin_at timestamptz not null,
  claim_initiated_at timestamptz,
  claimer         text,
  created_at      timestamptz not null,
  updated_slot    bigint not null            -- last applied event slot (idempotency)
)

vault_beneficiaries (
  vault_address   text references vaults,
  beneficiary     text not null,
  share_bps       int not null,
  primary key (vault_address, beneficiary)
)

vault_balances (                              -- convenience cache; chain remains truth
  vault_address   text references vaults,
  mint            text not null,              -- 'SOL' sentinel or mint address
  amount          numeric not null,
  updated_at      timestamptz,
  primary key (vault_address, mint)
)

-- Append-only raw event log: THE source for rebuilding all projections
events (
  id              bigserial primary key,
  signature       text not null,
  slot            bigint not null,
  event_name      text not null,
  vault_address   text not null,
  payload         jsonb not null,
  ingested_at     timestamptz default now(),
  unique (signature, event_name, vault_address)   -- webhook redelivery idempotency
)

notifications (
  id              bigserial primary key,
  wallet          text not null,
  vault_address   text,
  kind            text not null,              -- reminder_50|reminder_80|reminder_95|claim_started|claim_weekly|beneficiary_changed|released
  channel         text not null default 'email',
  scheduled_for   timestamptz not null,
  sent_at         timestamptz,
  status          text not null default 'pending',  -- pending|sent|failed|superseded
  dedupe_key      text unique                 -- e.g. vault:kind:last_checkin_at
)

indexer_cursor ( id int primary key default 1, last_slot bigint, last_signature text, updated_at timestamptz )
```

## 5. Event processing & scheduling logic

1. **Ingest:** Helius POST → verify shared-secret header → insert raw `events` rows (upsert on unique key) → apply to projections in slot order per vault (`updated_slot` guard makes reapplication idempotent).
2. **On `CheckedIn` / any owner-signed event:** mark that vault's pending reminders `superseded`; schedule fresh reminders at `last_checkin + {50%, 80%, 95%} × inactivity_secs` (pg-boss `sendAfter`). Dedupe key ties reminders to the specific `last_checkin` value.
3. **On `ClaimInitiated`:** immediate `claim_started` email to owner (and weekly repeats until resolution); notify beneficiaries too ("your claim entered its 30-day challenge window").
4. **On `ConfigUpdated`:** immediate `beneficiary_changed` email — this is a security tripwire (attack-tree top-risk #1), on by default, cannot be disabled while vault is Active with balance.
5. **Cranker (hourly):** query vaults where `state = 'InChallenge' and claim_initiated_at + challenge_secs < now()` → submit `finalize_claim` then `distribute_*`; fee payer = ops wallet holding only gas money.
6. **Reconciler (hourly):** `getProgramAccounts` snapshot diffed against projections; discrepancy → Sentry alert (this is also the "impossible state" security tripwire from security.md §5.4).

## 6. Operational invariants (page-the-founder alerts)

- No successful reminder job in 24h while ≥1 vault has a pending reminder → alert (the silent-death failure mode).
- Any event application error / projection drift → alert.
- Webhook endpoint 5xx rate or zero deliveries in 6h while chain shows program activity → alert.
- Cranker failure for the same vault 3× → alert (a beneficiary is waiting on us).

## 7. API design (REST, JSON; all optional-path)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/siws` | — | Verify Sign-In-With-Solana signature → httpOnly session JWT |
| `GET /me` / `PATCH /me` | JWT | Email + notification prefs; triggers verification email on change |
| `GET /vaults?owner=` `GET /vaults?beneficiary=` | — (public data) | Indexed reads for dashboard & "vaults naming me" |
| `GET /vaults/:address` | — | Projection + balances + computed `claimable_at` |
| `GET /vaults/:address/activity` | — | Event history for the vault timeline UI |
| `POST /webhooks/helius` | shared secret | Ingest |
| `GET /healthz` `GET /metrics` | — / internal | Ops |

No write endpoints touch the chain on behalf of users — all transactions are built client-side and signed by the user's wallet. SIWS exists solely to bind an email to a wallet with proof of key ownership.

## 8. What we deliberately don't build (MVP)

SMS/push (email only; SMS is the first post-MVP channel), GraphQL, multi-region, admin panel (Supabase Studio), historical analytics warehouse (the `events` table *is* the analytics source; a BI tool reads it directly).
