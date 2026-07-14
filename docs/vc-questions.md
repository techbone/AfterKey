# Brutal Critique & Hard Questions — AfterKey

Written as three hostile reviewers: a Solana VC, a Solana Foundation grant reviewer, and a hackathon judge. Every objection stated at full strength, then our current best answer and its honest grade (A = solid, B = defensible, C = real weakness we're carrying).

## The kill-shot questions

### 1. "Nobody wakes up wanting this. How do you sell a product about death to people who feel immortal?" — VC
Life insurance built a trillion-dollar industry on the same psychology — but with salespeople and regulatory forcing functions we don't have. Our honest wedge is narrower: crypto holders who have already had the scare (illness, a friend's loss, a near-miss) or a nagging spouse. Content marketing on "lost crypto" stories converts exactly this moment.
**Grade: C.** Activation is the single biggest product risk, bigger than anything technical. Beta funnel data is the only real answer; if <1% of visitors create a vault, the thesis needs rework (bundle into wallets rather than standalone).

### 2. "Your user checks in once, forgets the app exists, and dies with the vault misconfigured — or alive-but-annoyed after a false claim. Engagement products die; set-and-forget products get forgotten. Which are you?" — Judge
Deliberately set-and-forget: any wallet activity we can piggyback on... except we can't — only *vault* interactions reset the timer. That's a real UX flaw: a user active on Solana daily but silent on our program looks dead to us.
**Grade: C, with a roadmap answer.** Post-MVP: optional "activity oracle" — permissionless ix proving the owner key signed *any* recent transaction (e.g. via recent-blockhash-signed message relayed by our cranker), or wallet-integration hooks. For MVP, aggressive reminders paper over it. This objection is correct and we should say so before judges find it.

### 3. "The challenge window means beneficiaries wait months-to-years grieving while a countdown runs. Grandma will not run a Solana CLI. Is the claimant experience actually humane?" — Foundation
The inactivity period IS the estate-settlement delay (probate takes 9–24 months in the US; we're competitive), and the claim flow is one guided web page — CLI is the disaster-recovery path, not the product. The inheritance-letter PDF tells beneficiaries exactly what to do while the owner is alive.
**Grade: B.** True remaining gap: a beneficiary with zero crypto familiarity still needs a wallet and gas. Post-MVP: fee-payer sponsorship + embedded-wallet onboarding for claimants.

### 4. "Compromised key = attacker silently swaps beneficiaries and waits. You've turned wallet theft into estate theft." — Judge (security)
True and documented (attack-tree #1). MVP ships the tripwire (instant email on any beneficiary change, non-disableable); timelock on changes is the first post-MVP feature. Also true: the attacker with the key can already steal everything *today* — we add a delayed variant, not a new theft.
**Grade: B.** Honest, mitigated, roadmapped — but expect this question in every security review.

### 5. "Why does this need to be a company? It's a feature. Phantom ships 'inheritance' in a quarter and you're dead." — VC
Wallets have avoided this for years because it's a liability-and-support minefield (death of users is not a feature team's happy place) and it requires protocol-level neutrality (a Phantom-only vault doesn't cover your Ledger). Our endgame is being the neutral layer wallets integrate rather than build.
**Grade: B.** The defense is real but timing-dependent: we must reach "obvious integration partner" credibility (audit + users) before any wallet decides to build. That's the race.

### 6. "No revenue, no token, free product. What exactly is the business?" — VC
Deliberate sequencing: trust first (see grant-strategy.md §7), claim fees later — charged at the moment of maximum delivered value, on a TVL base that compounds for years before any claim. Inheritance has negative churn: vaults literally can't leave without the owner acting.
**Grade: C as a venture pitch, A as a grant pitch.** This may genuinely be a lifestyle-scale or infrastructure/public-good business rather than venture-scale. Decide which game we're playing before raising; do not pitch VCs with grant logic.

### 7. "TVL sitting idle in vaults is dead capital. Users will keep assets working in DeFi, not parked in your box." — VC
Sharpest version of the objection. Answers: (a) the target user's cold-storage allocation is *already* idle by choice; (b) roadmap: delegate-while-alive designs (vault holds LSTs; owner keeps yield) — but naming LSTs invites "why not just hold JitoSOL in the vault"... which works today: the vault holds any SPL token including LSTs.
**Grade: B.** "Deposit your LST" is actually a decent answer; make it a documented pattern, not an accident.

### 8. "Solana-only caps you at one ecosystem's demographics, and Solana holders skew young — the people least likely to plan estates." — Foundation/VC
Young holders die too (the demo... doesn't say that out loud); more usefully: early-adopter wealth concentration means even a small conversion of Solana OGs is real TVL, and the 6–8 week Solana-only MVP is a sequencing choice, not a ceiling.
**Grade: B.**

### 9. "What happens the first time you get sued — a disinherited family, a vetoed 'rightful heir,' a probate court ordering you to reverse a distribution you cannot reverse?" — everyone
Non-custodial architecture means there is nothing we *can* reverse or seize — same legal posture as any protocol developer, and the ToS says software-not-estate-planning. But US estate law has never met a dead-man's switch; a court may not care about our architecture diagrams.
**Grade: C.** The legal memo (roadmap M6) is mandatory, not optional. Conflicts between on-chain shares and a legal will are guaranteed eventually. Position: the vault is a *transfer mechanism* the deceased configured, like a joint account — but get real counsel.

### 10. "Your demo compresses a 1-year timer into 3 minutes. The real product has a feedback loop measured in YEARS. How do you know any of it works — notifications, claims, human behavior — before you have a decade of cohort data?" — Judge
Devnet compressed-timer drills exercise the full mechanical loop with real humans; the behavioral loop (do people check in for years?) is genuinely unknowable early.
**Grade: C, unavoidable.** Every long-horizon product has this; instrument reminder-response rates from day one as the leading indicator.

## Rapid-fire (one-line answers to have loaded)

- "Sybil beneficiaries laundering...?" — No: only owner-chosen keys receive funds; there's no permissionless inflow/outflow to abuse.
- "Why Anchor and not Pinocchio/native for CU?" — CU is irrelevant at heartbeat frequency; audit legibility wins.
- "Why not zk-proof of death / oracle networks?" — No reliable death oracle exists at consumer scale; absence-measurement needs no oracle at all.
- "Program frozen means no fee switch later?" — New versioned deployment + opt-in migration; freezing v1 is a user promise, not a business straitjacket.
- "GDPR/right-to-erasure on immutable beneficiary pubkeys?" — Pubkeys on-chain are pseudonymous; PII lives only in our deletable Postgres.
- "What's defensible here? It's 12 instructions." — Nothing in the code; everything in trust, audits, integrations, and being first to boring reliability. Security products compete on reputation, not features.

## Synthesis: the three real risks (what we'd tell ourselves as investors)

1. **Demand risk (dominant):** death-planning apathy. Only beta funnel data resolves it. Cheap to test — that's the whole point of the 8-week MVP.
2. **Business-model risk:** may be a grant-funded public good, not a venture business. Decide the game before raising.
3. **Time-loop risk:** trust compounds slowly and one false release ends everything — which is why the docs over-invest in security relative to a normal MVP.

Everything else — tech, Solana, competition — is executable with known tools.
