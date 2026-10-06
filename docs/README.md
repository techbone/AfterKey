# AfterKey — Documentation Index

AfterKey is a non-custodial crypto inheritance protocol on Solana. Owners keep full control of their assets; beneficiaries can claim only after a configurable inactivity period plus an on-chain challenge window during which the owner can veto with a single signature.

This `/docs` folder is the operating system of the company. Every document is written so a new engineer — or an AI agent — can continue building without any other context.

## Reading order

| # | Document | What it answers |
|---|----------|-----------------|
| 1 | [vision.md](vision.md) | Why this exists, who it's for, what winning looks like |
| 2 | [prd.md](prd.md) | Product requirements, user stories, MVP scope, non-goals |
| 3 | [architecture.md](architecture.md) | System-level architecture: how the pieces fit together |
| 4 | [smart-contracts.md](smart-contracts.md) | Complete Anchor program design: accounts, PDAs, instructions, events, state machine |
| 5 | [backend.md](backend.md) | Indexer + notification service: stack, DB schema, API, queues |
| 6 | [frontend.md](frontend.md) | Next.js app: structure, wallet integration, state, data fetching |
| 7 | [security.md](security.md) | Threat model, trust assumptions, mitigations, audit plan |
| 8 | [attack-tree.md](attack-tree.md) | Formal attack tree: every path to loss of funds or grief |
| 9 | [roadmap.md](roadmap.md) | Milestones 1–7 with objectives, deliverables, effort, success criteria |
| 10 | [sprint-plan.md](sprint-plan.md) | 90-day execution plan, week by week, zero → public beta |
| 11 | [grant-strategy.md](grant-strategy.md) | Solana ecosystem positioning, grant targets, hackathon plan |
| 12 | [pitch-deck.md](pitch-deck.md) | Slide-by-slide pitch narrative with speaker notes |
| 13 | [vc-questions.md](vc-questions.md) | Brutal self-critique: every reason this fails, and the hard questions to prepare for |
| 14 | [repo-blueprint.md](repo-blueprint.md) | Monorepo layout, CI/CD, testing, environments, developer workflow |
| 15 | [hackathon-readiness.md](hackathon-readiness.md) | October 2026 assessment, submission sprint and two-wallet checklist |
| 16 | [closure-recovery.md](closure-recovery.md) | Updated closure behavior, retained rent and owner/beneficiary recovery invariants |
| 17 | [devnet-key-recovery.md](devnet-key-recovery.md) | Encrypted deployment backup, restore and fresh deployment workflow |

## Canonical decisions (source of truth)

These decisions are fixed for the MVP. If a document contradicts this list, this list wins.

- **Chain:** Solana only. Multi-chain is explicitly post-MVP.
- **Framework:** Anchor (latest stable, 0.31.x at time of writing).
- **Model:** Dead-man's switch. No death oracles, no legal attestation, no KYC in v1.
- **Custody:** Non-custodial. Assets sit in a vault PDA the owner controls. The owner can withdraw everything at any time while the vault is `Active`.
- **Assets:** SOL and SPL tokens in MVP. Token-2022 and NFT-focused UX are post-MVP.
- **Beneficiaries:** Up to 10 per vault, shares in basis points summing to 10,000.
- **Timing:** Inactivity period is owner-configurable (min 30 days; presets 6m / 1y / 2y). Challenge period defaults to 30 days (min 7).
- **Claim flow:** beneficiary `initiate_claim` → challenge window → owner `veto_claim` (any owner signature also counts as life) or `finalize_claim` → per-mint `distribute` crank → `Closed`.
- **Backend:** Optional convenience layer only. The protocol must be fully usable with just a wallet and the chain. Backend = Fastify + Postgres (Supabase) + pg-boss + Helius webhooks + Resend email.
- **Frontend:** Next.js (App Router) on Vercel, `@solana/wallet-adapter`, TanStack Query, Zustand, Tailwind + shadcn/ui. Sign-In-With-Solana for the (optional) notification account.
- **Upgrades:** The devnet prototype uses a single encrypted deployment authority. The planned beta requires a Squads multisig; freeze or move to governance after audit + stability period.
- **Fees:** Zero protocol fees at MVP. Monetization decisions deferred (see vision.md).
- **Name:** **AfterKey** — repo, product, and brand all use one name. (Earlier drafts of these docs used a placeholder codename, "Proof of Life," before the product name was finalized; that name has been fully retired.)
