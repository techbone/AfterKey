# Pitch Deck — AfterKey

Slide-by-slide narrative with speaker notes. Target: 3-minute hackathon pitch / 10-minute VC version (extended notes marked ⏱).

---

## 1 · Title
**AfterKey** — Crypto inheritance without giving anyone your keys.
*Speaker note:* Open with the question, not the product: **"If you died tonight, what happens to your SOL?"** Pause. Every person in the room has no good answer. That silence is the pitch.

## 2 · Problem
- Millions of BTC — tens of billions of dollars across chains — permanently lost, much of it to death without key handover. The number only grows as early adopters age.
- Wills can't sign transactions. Courts can't move tokens.
- Today's "solutions": share your seed phrase (a live security hole), use a custodian (defeats self-custody), or hope.
*Note:* one concrete story lands harder than statistics — use a documented lost-fortune case.

## 3 · Insight
**You can't prove death on-chain. You can prove absence.**
A dead-man's switch captures inheritance semantics with zero oracles, courts, or trusted parties: *"If I go silent for a year, and ignore 30 days of final warnings, give my assets to my family."* The owner's ordinary liveness IS the proof.

## 4 · Product (demo slide)
1. Create a vault → deposit → name beneficiaries with shares → pick a timer (6m/1y/2y).
2. Live your life. One click — or any vault activity — resets the timer.
3. Go silent past the deadline → beneficiary claims → 30-day challenge window with alerts on every channel → one signature cancels everything → true silence releases the assets, trustlessly, per your shares.
*Note:* run it LIVE on devnet with compressed timers — create, claim, veto, then let one release. The moment tokens land in the "widow's" wallet is the demo climax.

## 5 · Why now / why Solana
- Fee economics: a heartbeat costs a fraction of a cent — this product category is only viable on a low-fee chain. **Only possible on Solana** at consumer scale.
- First serious mover in the Solana inheritance slot.
- Ecosystem tailwind: Foundation/Colosseum actively fund consumer security infra.

## 6 · How it's built (trust slide)
- Non-custodial: assets in a PDA vault **only the owner controls** — withdraw anything, anytime, while active. We can never touch funds. Ever.
- Permissionless completion: if our company vanishes, inheritances still finalize — anyone can crank the final instructions; we publish the CLI runbook.
- Published attack tree, exhaustive state-machine tests, audit scheduled, then we **freeze the program**. Inheritance software should be immutable and boring.
*Note ⏱:* for technical judges, name the top residual risks unprompted (compromised-owner beneficiary swap → change alerts + timelock roadmap). Volunteering your weaknesses is what security credibility sounds like.

## 7 · Market
- Wedge: Solana self-custody holders with families — the "hodler with a spouse" is a real, reachable, motivated segment.
- Expansion: every wallet needs this feature and none want to build it → SDK/CPI = inheritance-as-infrastructure (B2B2C).
- Macro: the largest generational wealth transfer in history is starting, and for the first time it includes crypto.

## 8 · Business model
Free at launch — trust before monetization. Then: claim fee (~50 bps, charged at the moment of delivered value), premium notification/guardian tiers, wallet licensing. No token. No custody fees. *Note ⏱:* if pushed on "free = no business," the answer: distribution and trust are the moat in a product where switching means moving your family's inheritance; monetizing claims aligns us with successful outcomes.

## 9 · Traction & roadmap
- [fill at pitch time: devnet demo live · N beta vaults on mainnet · N completed test inheritances · audit status]
- 90 days: program + app + notifications → private beta → audit → public launch (docs: full milestone plan, threat model, and architecture published in-repo).

## 10 · Team + Ask
- [Team background]
- **Hackathon ask:** try it, judge the docs depth, remember the question from slide 1.
- **VC ask ⏱:** $[X] pre-seed → audit, launch, first wallet integration, 12 months runway for a 2–3 person team.
*Close by returning to the open:* "You still don't have an answer for tonight. Now there is one."

---

## Appendix slides (have ready, don't present)
- A1: Full architecture diagram (architecture.md §1)
- A2: State machine (smart-contracts.md §3)
- A3: Threat model summary + trust-assumption table (security.md §2)
- A4: Competition: EVM inheritance products (Safe modules, Sarcophagus-lineage), custodial estate services (Casa etc.) — matrix on custody / chain / oracle-dependence / permissionless completion
- A5: Post-MVP roadmap (roadmap.md) — encrypted legacy messages, guardians, SDK, multi-chain posture
