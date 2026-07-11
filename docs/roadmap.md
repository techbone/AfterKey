# Development Roadmap — Proof of Life

Team assumption: **2 engineers** (1 Rust/Anchor-capable, 1 full-stack TS) + founder doing PM/design/BD. Effort figures = calendar weeks at that staffing. Target: mainnet-capable MVP in **8 weeks**, public launch after audit (~week 12–14). See [sprint-plan.md](sprint-plan.md) for the day-level 90-day version.

## Milestone 1 — Technical Validation (Week 1)

- **Objectives:** de-risk every novel assumption before writing product code.
- **Deliverables:** spike repo with (a) clock-warp test harness (LiteSVM) proving time-based assertions are testable, (b) 10-way SPL distribution in one tx under CU budget, (c) Helius webhook → local handler round trip, (d) Squads multisig created and a test program deployed + upgraded through it; docs/ finalized (this folder); go/no-go review of smart-contracts.md.
- **Effort:** 1 week, both engineers.
- **Dependencies:** none.
- **Success criteria:** all four spikes pass; no design change required to smart-contracts.md, or changes made and re-reviewed.

## Milestone 2 — Smart Contract MVP (Weeks 2–4)

- **Objectives:** complete, tested `proof_of_life` program on devnet.
- **Deliverables:** all 12 instructions per smart-contracts.md §5; full state-machine × signer test matrix + time-travel + distribution proptests (§10); `devnet-timing` feature; IDL published to `packages/program`; deployed to devnet via multisig; a scripted CLI walkthrough of the full lifecycle (doubles as the G3.1 "claim without us" runbook).
- **Effort:** 3 weeks (Rust engineer full-time; full-stack engineer pairs on tests + starts M3 scaffolding in week 3).
- **Dependencies:** M1.
- **Success criteria:** test matrix 100% green in CI; full lifecycle executed on devnet end-to-end from CLI; internal design review signs off that no instruction violates the pause-asymmetry and owner-sovereignty invariants.

## Milestone 3 — Frontend MVP (Weeks 4–6)

- **Objectives:** a stranger with Phantom can complete the whole owner + beneficiary journey on devnet without help.
- **Deliverables:** all routes in frontend.md §2; wizard, dashboard/countdown, claim flow, inheritance-letter PDF; Playwright lifecycle e2e; deployed on Vercel against devnet.
- **Effort:** 2.5 weeks (full-stack engineer; Rust engineer moves to M4 backend after program freeze).
- **Dependencies:** M2 IDL freeze (interface freeze end of week 3).
- **Success criteria:** 5 unaided external testers each complete create→check-in→claim→veto→finalize on devnet; e2e suite green in CI.

## Milestone 4 — Backend Services (Weeks 5–6, parallel with M3)

- **Objectives:** notifications + indexing + cranker live for devnet.
- **Deliverables:** everything in backend.md: indexer with reconciler, reminder scheduling, claim alerts, beneficiary-change tripwire email, cranker, SIWS + prefs, `/vaults` reads; deployed with Sentry + uptime alerts wired to founder's phone.
- **Effort:** 2 weeks.
- **Dependencies:** M2 events schema; M3 settings page consumes SIWS (thin coupling, stub early).
- **Success criteria:** reminder fires correctly against a compressed-timer devnet vault; claim alert lands in inbox <5 min after on-chain event; reconciler detects an artificially injected projection error; ops invariants (backend.md §6) alert in a fire-drill test.

## Milestone 5 — Security Hardening (Weeks 6–7)

- **Objectives:** internal assurance complete; external audit booked.
- **Deliverables:** adversarial test additions from a fresh pass over attack-tree.md; static analysis (cargo-audit, Sec3/X-ray class) clean; frontend tx-building red-team day; incident-response runbook rehearsed; audit firm selected, scoped, and scheduled; `security.txt` + disclosure policy published.
- **Effort:** 1.5 weeks both engineers (audit itself is external and runs during M6–M7 window).
- **Dependencies:** M2 code freeze for audit scope.
- **Success criteria:** zero known highs/mediums open internally; signed audit engagement with start date ≤ week 9.

## Milestone 6 — Private Beta (Weeks 7–8)

- **Objectives:** real users, real behavior, devnet + limited mainnet.
- **Deliverables:** mainnet deploy (multisig, soft UI deposit caps per security.md §5.5); 25–50 invited beta users from Solana communities; feedback loop (weekly calls + in-app form); legal memo on regulatory posture (attack-tree 5.3); analytics on funnel drop-off (events table + PostHog or plain SQL).
- **Effort:** 2 weeks, all hands (heavier on founder for recruitment/support).
- **Dependencies:** M3 + M4 complete; M5 internal pass done (external audit may still be running — hence caps and "beta" labeling).
- **Success criteria:** ≥25 mainnet vaults; ≥1 full compressed-timer inheritance completed by beta users on devnet; zero Sev-1s; NPS-style qualitative signal collected; top-3 friction points identified and fixed.

## Milestone 7 — Public Launch (Weeks 9–12+)

- **Objectives:** audited, public, growing.
- **Deliverables:** audit report remediated + published; upgrade-authority decision executed (freeze vs. timelocked governance — bias freeze, per smart-contracts.md §9); bug bounty live; launch content (security honesty page, "claim via CLI" public runbook, inheritance-letter template); Colosseum/grant submissions per grant-strategy.md; caps raised/removed.
- **Effort:** 2–4 weeks (audit remediation dominates the variance).
- **Dependencies:** audit complete; M6 beta learnings applied.
- **Success criteria:** prd.md §8 metrics (100 mainnet vaults in 30 days, 60% email opt-in, zero incidents); at least one grant/accelerator application submitted; one wallet-integration conversation started.

## Post-MVP roadmap (ordered by value/effort, revisit after beta data)

1. **Beneficiary-change timelock + alerts hardening** — top residual risk (attack-tree #1).
2. **Encrypted legacy messages** — letter/instructions to beneficiaries, client-side encrypted, revealed on release. High emotional value, low protocol risk.
3. **SMS + push escalation channels**; guardian "nudge" contacts (non-signing humans who get told to go check on you).
4. **Token-2022 + NFT UX**; staked-SOL positions.
5. **Multiple vaults UI**, per-beneficiary fallback addresses.
6. **SDK + CPI interface** for wallet partners (the B2B2C wedge).
7. **Claim-fee monetization experiment** (50 bps) once trust is established.
8. **Multi-chain research** — only after Solana PMF; likely EVM via an equivalent-but-separate deployment, not bridges.
