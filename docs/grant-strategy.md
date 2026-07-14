# Grant Strategy & Solana Ecosystem Positioning — AfterKey

## 1. Positioning statement

**"Solana's inheritance layer."** AfterKey is public-goods-adjacent consumer security infrastructure: it directly addresses self-custody's scariest failure mode, makes holding on Solana safer for ordinary users, and (via SDK/CPI later) becomes a primitive other Solana products embed. This is the exact profile ecosystem funders exist to support: clear user harm being solved, non-custodial, non-speculative, no token, composable.

## 2. Why funders should care (the three arguments)

1. **Ecosystem-retention argument:** every permanently lost wallet is TVL and users subtracted from Solana forever. Inheritance infrastructure compounds ecosystem value.
2. **Self-custody-adoption argument:** "what if I die?" is a genuine, documented blocker moving mainstream users from exchanges to self-custody. Solving it grows the whole self-custody funnel — a Foundation-level goal.
3. **Differentiation argument:** cheap heartbeats make dead-man's-switch UX viable *only* on a low-fee chain. This is a product category Solana can own; on L1 Ethereum the economics are hostile. "Only possible on Solana" is the strongest sentence in any Solana grant application.

## 3. Funding targets, in order

| Target | Fit | Ask | Timing |
|---|---|---|---|
| **Colosseum hackathon → accelerator** | Primary. Purpose-built for exactly this journey; winning/placing = credibility + $250k pre-seed path | Submission with live devnet demo + this docs folder | Next open cohort; MVP timeline (roadmap.md) is deliberately hackathon-shaped |
| **Solana Foundation grants** | Strong: consumer security infra, no token, open-source program | $25–50k milestone-based (audit funding is the most legible ask: "fund the audit" is concrete, verifiable, and de-risks users) | Apply at M6 with beta traction |
| **Superteam (regional) grants/bounties** | Fast, small ($1–10k), plus distribution: Superteam networks are the beta-tester and content channel | Instant grant for specific deliverables (e.g. the open-source claim-CLI runbook) | Week 4+ |
| **Wallet ecosystem partnerships** (Phantom/Solflare/Backpack) | Not cash — distribution. Inheritance is a feature they get asked for and won't build soon | Integration conversation, co-marketing | Post-audit (M7); they will not touch unaudited custody-adjacent code |
| **Angels/pre-seed** | After Colosseum result or beta metrics | $250–500k SAFE if going venture path | Post-Day-90 decision |

## 4. Grant application skeleton (reusable)

1. **Problem:** billions permanently lost; wills can't sign transactions; seed-sharing is a vulnerability, custodians defeat self-custody. (One real anecdote > three statistics.)
2. **Solution:** non-custodial dead-man's switch; owner sovereignty; challenge window; permissionless completion. One diagram (architecture.md §1).
3. **Why Solana / only-on-Solana:** fee economics of heartbeats; ecosystem composability; unclaimed category.
4. **Traction:** devnet demo link, beta vault counts, completed test inheritances, external testers quotes.
5. **Team:** shipped Solana program with exhaustive state-machine tests + published attack tree (link the repo — the security documentation IS the credibility).
6. **Ask & milestones:** tie every dollar to a verifiable deliverable (audit report, mainnet launch, SDK release).
7. **Open-source commitment:** program code Apache-2.0/MIT from day one; the claim-CLI runbook as a public good.

## 5. Hackathon readiness checklist (Colosseum-shaped)

- [ ] 3-minute demo video: create vault → check in → (clock-warp) → claim → challenge → veto, then the darker take: no veto → distribution lands in beneficiary wallet. Compressed-timer devnet build makes this live-demoable (architecture.md §5).
- [ ] Live devnet deployment + hosted frontend anyone can try during judging.
- [ ] Public repo with this `/docs` folder — judges reward evident depth of thinking; the attack tree and state-machine test matrix are unusual and memorable.
- [ ] One-pager (pitch-deck.md condensed).
- [ ] The emotional hook rehearsed: *"If you died tonight, what happens to your SOL?"* Every judge personally feels this problem.

## 6. Ecosystem narrative & community plan

- **Content wedge (founder, weekly from week 4):** "death and self-custody" content is under-produced and evergreen — threads/posts on lost-crypto stories, how the protocol makes each impossible, honest write-ups of our own attack tree. Security honesty as brand.
- **Distribution:** Superteam networks, Solana Reddit/Twitter, wallet communities; beta invites as scarce artifacts.
- **Credibility sequence:** public docs → devnet demo → hackathon placement → audit → wallet conversations. Each unlocks the next; don't skip forward (an unaudited inheritance protocol asking for wallet integration reads as dangerous, not ambitious).

## 7. What we do NOT do

No token, no points program, no TVL-mercenary incentives, no "partnership" announcements without shipped integrations, no multi-chain promises in applications. Funders in 2026 pattern-match these as red flags for exactly the kind of product that must be boring and trustworthy.
