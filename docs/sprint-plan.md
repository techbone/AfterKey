# 90-Day Execution Plan — Zero to Public Beta

Assumes start Monday of Week 1. Team: Rust engineer (RE), full-stack engineer (FE), founder (F). Maps to [roadmap.md](roadmap.md) milestones; this is the operational week-by-week.

## Phase 1 — Validate & Foundation (Days 1–7 · Milestone 1)

**Week 1**
- RE: LiteSVM clock-warp spike; 10-way distribution CU test; deploy+upgrade a hello program through a fresh Squads 2-of-3.
- FE: monorepo scaffold per repo-blueprint.md (pnpm workspaces, CI skeleton, Vercel + Fly projects, Supabase instance); Helius webhook round-trip spike.
- F: finalize docs (this folder); recruit 2 external design-review readers for smart-contracts.md; open Colosseum/grant calendars (grant-strategy.md); start beta-tester list (target 100 names by week 6).
- **Gate (Day 7):** go/no-go on program design. Any change → 1-day re-review, not silent drift.

## Phase 2 — Program (Days 8–28 · Milestone 2)

**Week 2** — RE: accounts, init/check-in/deposit/withdraw + their tests. FE: test-matrix harness (state × signer grid as table-driven tests), CI for Anchor.
**Week 3** — RE: claim/veto/finalize/distribute + time-travel and proptest suites. FE: starts web scaffold, wallet connect, `useVault` against a stub IDL. **Interface freeze Friday: IDL v1 tagged.**
**Week 4** — RE: adversarial tests, `devnet-timing` feature, devnet deploy via multisig, CLI lifecycle script. FE: vault wizard. F: drafts landing-page copy + security honesty page from security.md.
- **Gate (Day 28):** full lifecycle on devnet from CLI; test matrix 100%.

## Phase 3 — Product (Days 29–49 · Milestones 3+4 in parallel)

**Week 5** — FE: dashboard + countdown + check-in + withdraw + settings. RE: backend scaffold, indexer + events table + projections, reconciler.
**Week 6** — FE: claim flow + inheritance-letter PDF + Playwright lifecycle e2e. RE: pg-boss reminders, claim alerts, beneficiary-change tripwire, cranker; Sentry/uptime paging fire drill.
**Week 7** — Integration week: SIWS + settings page; polish; empty/error states; copy pass ("scared spouse" test, frontend.md §6); 5 unaided external testers run the devnet gauntlet; fix what they hit.
- **Gate (Day 49):** M3+M4 success criteria met (roadmap.md).

## Phase 4 — Hardening (Days 50–60 · Milestone 5)

**Week 8** — Both: attack-tree re-walk against real code; static analysis; frontend tx-building red-team day; incident-response tabletop. F: audit firm outreach concluded → signed engagement (started outreach week 4; firms book out weeks ahead — this is why).
**Week 9 (first half)** — Fix everything found; code freeze for audit; hand off scope package (program, tests, this docs folder — auditors love arriving to an attack tree).
- **Gate (Day 60):** zero known highs/mediums; audit start date confirmed.

## Phase 5 — Private Beta (Days 61–90 · Milestone 6 → beta)

**Week 9 (second half) + Week 10** — Mainnet deploy behind soft caps + "beta" labels; onboard first 10 invited users personally (F watches each session — this is the cheapest UX research that exists); devnet compressed-timer inheritance drill with 5 testers playing owner+beneficiaries end to end.
**Week 11** — Expand to 25–50 users; weekly feedback calls; fix top-3 frictions; legal memo delivered; grant application(s) submitted with beta traction numbers.
**Week 12** — Beta stabilization; audit likely in flight; publish "claim via CLI" runbook + security honesty page; prep launch content; decide upgrade-freeze plan for M7.
- **Day 90 exit criteria:** ≥25 mainnet vaults · ≥1 completed devnet inheritance by real testers · zero Sev-1 · audit underway · ≥1 grant application submitted · launch plan written.

## Operating cadence

- **Daily:** 15-min async standup (written, in repo `journal/` or Slack).
- **Weekly:** Friday demo of working software (no slides); metrics snapshot (vaults, check-ins, funnel); risk review — one standing question: *"what changed in the attack tree this week?"*
- **Rules:** no new scope enters a phase after its first day (park in `docs/roadmap.md` post-MVP list); every gate is a real meeting with a written verdict; anything that slips a gate by >3 days triggers scope-cut discussion, never timeline extension past Day 90.

## Pre-mortem (top 3 slippage causes, countermeasures baked in above)

1. **Program takes >3 weeks** → interface freeze at week 3 lets FE proceed on IDL v1; distribution edge cases are the likely sink — proptests early (week 3, not week 4).
2. **Audit scheduling** → outreach begins week 4, not week 8.
3. **Beta recruitment fizzle** → founder builds the 100-name list from week 1, not week 9; personal onboarding beats broadcast invites.
