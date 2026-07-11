# Product Requirements Document — Proof of Life MVP

**Status:** Draft v1 · **Owner:** Founder · **Target:** Working Solana MVP in 6–8 weeks

## 1. Summary

A Solana dApp where users create non-custodial inheritance vaults. Assets release to designated beneficiaries only after (a) an owner-configured inactivity period elapses AND (b) a challenge window passes without any sign of life from the owner.

## 2. Goals / Non-goals

### Goals (MVP)
- Create/manage a vault holding SOL and SPL tokens.
- Configure up to 10 beneficiaries with percentage shares.
- One-click proof-of-life check-in.
- Beneficiary-initiated claim with a challenge period and owner veto.
- Trustless distribution per shares after the challenge window.
- Email reminders before the inactivity threshold and alerts on claim initiation.
- Devnet demo quality good enough for a hackathon submission and grant application.

### Non-goals (MVP) — explicitly out
- Multi-chain support.
- Death certificates, oracles, KYC, legal integration.
- Token-2022, compressed NFTs, staked SOL, DeFi positions.
- Mobile apps (responsive web only).
- Social recovery / guardians / multisig owners.
- Encrypted message/letter to beneficiaries (fast follow, not MVP).
- Protocol fees or payments.

## 3. Personas

- **Owner (primary):** Solana-native, self-custodies mid-5-figure+ portfolio, has a spouse/child/sibling in mind. Comfortable signing transactions; not a developer.
- **Beneficiary:** May be crypto-novice. Needs a guided claim flow: connect wallet, see what's claimable, click claim. Must be reachable by email if the owner registered one for them.
- **Watcher (implicit):** Anyone can crank `finalize_claim`/`distribute` — permissionless execution means no one must trust our backend to complete an inheritance.

## 4. User stories & acceptance criteria

### Vault lifecycle
| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| U1 | As an owner I create a vault with an inactivity period | Vault PDA created; period ∈ [30d, 10y]; presets 6m/1y/2y shown; state `Active`; `last_checkin = now` |
| U2 | As an owner I deposit SOL or an SPL token | Assets land in vault-controlled accounts; balance visible in UI within 10s |
| U3 | As an owner I add/edit/remove beneficiaries with shares | Max 10; shares sum to exactly 10,000 bps; only while `Active`; no duplicate keys |
| U4 | As an owner I check in | `last_checkin` updates; timer UI resets; costs one signature, <0.001 SOL |
| U5 | As an owner I withdraw any amount at any time while `Active` | Full or partial withdrawal succeeds; no cooldown, no fee |
| U6 | As an owner I close an empty vault | Rent returned; state `Closed` |

### Inheritance flow
| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| U7 | As a beneficiary I see vaults naming me | UI lists vaults where my pubkey is a beneficiary, with claimable-at date |
| U8 | As a beneficiary I initiate a claim after the inactivity period | Rejected if `now < last_checkin + inactivity_period`; on success state → `InChallenge`, event emitted, owner notified on all channels |
| U9 | As an owner I veto a claim | Single signature; state → `Active`; `last_checkin = now`; claim record cleared |
| U10 | As anyone I finalize a claim after the challenge window | Rejected if `now < claim_initiated_at + challenge_period`; state → `Released` |
| U11 | As anyone I trigger distribution per mint | Each beneficiary ATA receives `balance × share / 10000`; rounding dust to the last beneficiary; idempotent per mint |

### Notifications (backend)
| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| U12 | As an owner I register an email (optional) | SIWS-authenticated; verification email; can unsubscribe |
| U13 | As an owner I get check-in reminders | At 50%, 80%, 95% of inactivity period elapsed, and weekly during any challenge window |
| U14 | As an owner I get an immediate alert when a claim starts | Email within 5 minutes of the on-chain event |

## 5. Functional requirements

- **F1 — Liveness definition:** `check_in` and every owner-signed vault instruction (deposit, withdraw, config update, veto) reset `last_checkin`.
- **F2 — Timing:** All comparisons use the Solana Clock sysvar `unix_timestamp`. Minimum inactivity 30 days; minimum challenge 7 days, default 30.
- **F3 — Permissionless completion:** `finalize_claim` and `distribute` callable by anyone once time conditions hold, so inheritance completes even if every beneficiary is non-technical (our cranker or any third party can execute).
- **F4 — Config freeze during challenge:** While `InChallenge`, owner may only `veto_claim` or withdraw (withdrawing is also proof of life and auto-vetoes). No beneficiary edits mid-challenge.
- **F5 — Chain independence:** Every critical action (check-in, veto, claim, finalize, distribute) is a plain program instruction usable without our frontend or backend.

## 6. Non-functional requirements

- **Security:** No path to early release; owner-only authorities checked on every mutating instruction; full test coverage of the state machine (see security.md).
- **Reliability:** Backend downtime must never block or endanger funds — it only degrades notifications.
- **Performance:** Dashboard loads vault state in <2s on devnet/mainnet RPC; distribution of a 10-beneficiary vault fits in one transaction per mint.
- **Cost:** Vault creation < 0.01 SOL rent; check-in ≈ base fee.

## 7. Key UX decisions

- Timer is the hero UI: a single large "time until claimable" countdown with a prominent **I'm alive** button.
- Vault creation is a 3-step wizard (period → beneficiaries → deposit) with an explicit plain-language summary before signing: *"If you do nothing for 12 months, and ignore 30 days of warnings, these people receive these assets."*
- Beneficiary claim page is shame-free and simple — the claimer may be grieving and non-technical.
- Every destructive/irreversible action states exactly what happens in one sentence before the wallet popup.

## 8. Success metrics (beta)

- ≥ 100 vaults created on mainnet within 30 days of public launch.
- ≥ 60% of vault creators complete email registration (notification opt-in).
- ≥ 40% of owners check in at least once in the first month (engagement proxy).
- Zero incidents: no unintended releases, no stuck funds, no authority bugs.
- One full end-to-end inheritance completed on devnet with real testers (compressed timescales).

## 9. Open questions (tracked, not blocking)

1. Should beneficiary identities be hashed on-chain for privacy instead of raw pubkeys? (MVP: raw pubkeys; privacy is a documented trade-off — see security.md §Privacy.)
2. Grace mechanic: should a veto also auto-extend the inactivity period once? (MVP: no; veto just resets `last_checkin`.)
3. Multiple vaults per owner: supported by design (`vault_id` seed); UI exposes one vault in MVP, multiple post-MVP.
