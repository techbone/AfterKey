# Repository Blueprint — Proof of Life

Monorepo layout, CI/CD, environments, and developer workflow. Goal: any engineer or AI agent can clone, run one command, and have the full stack locally.

## 1. Monorepo layout (npm workspaces + Anchor workspace)

```
afterkey/
├── docs/                      # THIS folder — the company operating system
├── programs/
│   └── proof-of-life/         # Anchor program (Rust)
│       └── src/{lib.rs, state.rs, errors.rs, instructions/*.rs}
├── tests/                     # Anchor/LiteSVM TS tests: state-matrix/, time-travel/, distribution/, adversarial/
├── apps/
│   ├── web/                   # Next.js (frontend.md §5)
│   └── api/                   # Fastify service (backend.md §3)
├── packages/
│   ├── program/               # IDL + generated TS client (built artifact, committed per release tag)
│   ├── shared/                # zod schemas, types, constants (cluster/program-id per env)
│   └── cli/                   # `pol` CLI: create/check-in/claim/finalize/distribute — doubles as the public "claim without us" runbook tool
├── scripts/                   # deploy-devnet.ts, demo-lifecycle.ts (hackathon demo), reindex.ts
├── .github/workflows/         # ci.yml, deploy-web.yml, deploy-api.yml, program-release.yml
├── journal/                   # daily written standups (sprint-plan.md cadence)
├── Anchor.toml · Cargo.toml · package.json (npm workspaces) · biome.json · .env.example
└── SECURITY.md                # disclosure policy + security.txt contents
```

Toolchain pins: Rust + Solana CLI + Anchor versions in `rust-toolchain.toml` / `Anchor.toml`; Node via `.nvmrc` (npm ships with Node — no extra package manager to install). `npm run setup:local` = install, spin `solana-test-validator`, deploy program with `devnet-timing`, seed a demo vault, start api+web.

## 2. Environments & config

| Env | Program build | Cluster | Web | API/DB |
|---|---|---|---|---|
| local | `devnet-timing` feature (short minimums) | test-validator | localhost:3000 | localhost + docker Postgres |
| staging | `devnet-timing` | devnet | Vercel preview | Fly staging + Supabase staging |
| prod | **no features** (CI-asserted) | mainnet-beta | Vercel prod | Fly prod + Supabase prod |

All config via env vars validated by a zod schema at boot (`packages/shared/env.ts`); `.env.example` is exhaustive and commented. Program ID, cluster, and token list resolve from one `packages/shared/config.ts` switch — never hardcoded in app code.

## 3. CI/CD (GitHub Actions)

**`ci.yml` — every PR:**
1. Rust: `cargo fmt --check`, `clippy -D warnings`, `cargo audit`, `anchor build`.
2. **Feature-flag assertion:** grep the mainnet artifact build for `devnet-timing` — fail if present (architecture.md §5).
3. Program tests: full matrix + proptests on LiteSVM (fast, no validator container).
4. TS: Biome, typecheck, unit tests (`apps/api` with ephemeral Postgres service container).
5. Web: build + Playwright lifecycle e2e against local validator (the create→claim→veto→finalize→distribute gauntlet, frontend.md §6).
6. IDL drift check: `anchor build` IDL must match committed `packages/program/idl.json`.

**Deploys:**
- `deploy-web.yml`: Vercel previews per PR; prod on main tag.
- `deploy-api.yml`: Fly deploy on main; migrations run via drizzle-kit with `--dry-run` gate in CI.
- `program-release.yml` (manual dispatch, the serious one): builds **verifiable build** (solana-verify / Ellipsis verified-builds), uploads artifact + hash, opens a Squads multisig proposal — **CI never holds the upgrade key**; humans approve in Squads. Post-deploy job verifies on-chain hash matches CI artifact and tags the repo.

## 4. Testing strategy (summary; authoritative list in smart-contracts.md §10)

| Layer | Tool | Gate |
|---|---|---|
| Program state-machine × signer matrix | LiteSVM + table-driven TS | 100% of matrix, exact error codes |
| Time boundaries | LiteSVM clock warp | all `>` boundaries ±1s |
| Distribution invariants | proptest (Rust) | Σ out == in; no double-pay |
| API | vitest + Postgres container | webhook idempotency, reminder scheduling math |
| E2E | Playwright + test-validator | full lifecycle green |
| Manual | devnet compressed-timer inheritance drill | before each release |

## 5. Monitoring & analytics

- **Sentry** (api + web) with release tagging from CI.
- **Better Stack:** uptime on `/healthz`, log-based alerts wired to backend.md §6 invariants (silent-reminder-death, projection drift, cranker stalls) → founder phone.
- **On-chain watch:** reconciler doubles as security tripwire (security.md §5.4).
- **Product analytics:** the `events` table is the warehouse; funnel SQL in `scripts/analytics/`. PostHog on web for pre-wallet funnel (landing → wizard start → first signature). No third-party analytics receive wallet addresses.

## 6. Developer workflow & conventions

- Trunk-based: short-lived branches → PR → squash-merge; PR template includes *"does this change the attack tree?"* checkbox — any "yes" requires a docs/attack-tree.md diff in the same PR.
- Conventional commits; releases tagged `program-vX` / `web-vX` independently.
- Program code review rule: **two approvals** for anything under `programs/`, one elsewhere.
- `docs/` is load-bearing: architectural changes land as docs-PR first (or same PR), never code-only. The canonical-decisions list in docs/README.md governs conflicts.
- Secrets: Fly/Vercel/GitHub encrypted secrets only; ops wallet (cranker fee payer) holds gas only, rotated quarterly; the Squads keys live on hardware wallets, never in CI, never on dev machines.

## 7. Open-source posture

`programs/`, `packages/cli`, and `docs/{smart-contracts,security,attack-tree}.md` public from first devnet deploy (Apache-2.0) — grant-strategy.md depends on this credibility. Apps may stay private until beta; bias to opening everything at launch.
