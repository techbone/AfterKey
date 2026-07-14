# Security Model & Threat Analysis — AfterKey

Companion: [attack-tree.md](attack-tree.md) (formal tree). This document explains the model, ranks the threats, and states mitigations and accepted residual risks.

## 1. Security objectives, ranked

1. **No early release (integrity):** assets must never move to beneficiaries while the owner is alive and wants them — the cardinal failure.
2. **No theft (custody):** no party other than owner (while Active) or beneficiaries (after legitimate release) can ever extract assets.
3. **No permanent lock (liveness):** a legitimate inheritance must always be completable without our company existing.
4. **Grief resistance:** attackers can't impose meaningful cost/annoyance on owners or beneficiaries.

Privacy is a secondary objective in MVP (see §6).

## 2. Trust assumptions (honest list)

| Trusted party/thing | For what | Failure impact | Mitigation trajectory |
|---|---|---|---|
| Program code | Everything | Total loss | Tests → external audit → freeze |
| Upgrade authority (Squads 2-of-3) | Not deploying malicious code | Total loss | Freeze program post-audit (roadmap M7) |
| Solana validators / Clock | Timestamp honesty ± minutes | Negligible (windows ≥ 7 days) | None needed |
| Owner's own wallet key | Vault control | Same as any wallet compromise — see §4.3 | Product guidance: use hardware wallet for vault owner key |
| Backend/Helius/Resend | Notification delivery only | Missed reminders → owner might drift into claimable state; challenge window still protects | Multi-channel reminders; on-chain state is what matters |

Explicitly **not** trusted: our backend (can't move funds), our frontend (verify tx contents in wallet), beneficiaries, RPC providers (money-relevant UI reads verified against chain).

## 3. Threat catalog & mitigations

### 3.1 False inheritance claims (beneficiary attacks the living)
- **Attack:** beneficiary initiates a claim hoping the owner won't notice for the whole challenge window.
- **Mitigations:** claim only possible after the inactivity period already elapsed (owner was silent for months first); challenge window ≥ 7 days (default 30); multi-channel notification blitz on `ClaimInitiated`; *any* owner signature vetoes; withdrawal auto-vetoes.
- **Residual:** owner who is alive but off-grid past inactivity+challenge with no notification channel loses to their own beneficiary. Accepted and disclosed; the countermeasure is choosing honest beneficiaries and long periods — this is inheritance, beneficiaries are chosen, not adversarial strangers.

### 3.2 Beneficiary collusion
Multiple beneficiaries coordinating gains nothing beyond §3.1 — shares are fixed by the owner, claims don't need quorum, and colluding can't shorten timers. Collusion only matters in future guardian/attestation designs; noted for that design's threat model.

### 3.3 Griefing
- **Claim spam:** a beneficiary repeatedly claims the moment the vault is claimable, forcing veto gas on the owner. Low value (vetoes are ~free, and being claimable means the owner already ignored months of reminders). Post-MVP option if observed: per-beneficiary claim cooldown or a small claim bond slashed on veto. Not in MVP — bonds add UX friction to legitimate grieving claimers.
- **Dust/malicious-token deposits:** anyone can send tokens to vault ATAs. Distribution is per-mint and permissionless, so junk mints can be ignored forever; they can't block SOL/legit-mint distribution. UI shows curated token lists only.
- **ATA blocking:** distribution to a frozen beneficiary ATA fails per-mint only; retryable; other mints unaffected (smart-contracts.md §5).

### 3.4 Wallet compromise
- **Owner key stolen, vault Active:** attacker can withdraw everything — identical to the attacker's power over any wallet. The vault adds one *worse* capability: silently replacing beneficiaries and waiting. Mitigation (post-MVP, high value): optional **beneficiary-change timelock** (e.g. edits take effect after 7 days with notifications) — flagged as top roadmap security feature; omitted from MVP for scope, documented honestly.
- **Beneficiary key stolen:** attacker inherits the beneficiary's future claim. Owner mitigation: rotate beneficiary keys via `update_config` (a reason edits stay cheap). Beneficiary compromise discovered during a challenge → owner vetoes and edits.
- **Both owner dead AND a beneficiary key lost:** that share distributes to a dead address. Post-MVP: per-beneficiary contingent fallback. MVP: guidance to use fresh hardware-wallet keys for beneficiaries.

### 3.5 Time manipulation
Clock sysvar drift is bounded by validator consensus (minutes at worst) vs. windows of ≥7–30 days: not exploitable. Boundary semantics (`>` vs `>=`) tested explicitly. No reliance on slots for durations.

### 3.6 Program & operational risks
- **Malicious upgrade:** the #1 systemic risk — Squads 2-of-3 now, freeze later (roadmap). Publish the authority address; users can verify.
- **Admin abuse:** `paused` intentionally cannot block check-ins, vetoes, withdrawals, or claim finalization (smart-contracts.md §4.1) — a hostile admin can only stop *new* vaults/deposits.
- **Classic Solana bugs:** missing signer/owner checks, account substitution, arbitrary CPI, math overflow — addressed by Anchor constraints, `checked_*` everywhere, the adversarial test matrix, and audit focus areas listed in §5.
- **Frontend supply chain:** a hijacked frontend can craft malicious txs for users to sign (e.g. `update_config` swapping beneficiaries to attacker keys). Mitigations: dependency pinning + lockfile audit in CI, CSP, and human-readable transaction summaries so wallet simulation shows sensible effects. Residual risk shared with all dApps.
- **Social engineering:** "AfterKey support" phishing asking owners to sign things, or fake claim-notification emails with lookalike links. Mitigations: signed email domain (DKIM/DMARC/BIMI), an explicit product rule communicated repeatedly — *we will never ask you to sign anything from an email link; always type the URL* — and notification emails containing no transaction links at all, only instructions to visit the app directly.

## 4. Privacy (accepted MVP trade-off)

Vault contents, beneficiary pubkeys, and timing are public on-chain. Consequences: beneficiaries can be identified and socially engineered; the claimable date is a public countdown for thieves targeting the *owner's other* assets. Disclosed in docs/UI. Post-MVP research: hashed beneficiary commitments (claim reveals preimage), which costs beneficiary-discovery UX.

## 5. Audit & hardening plan

1. **Internal (Milestone 5):** the smart-contracts.md §10 matrix at 100%; Sec3 X-ray / cargo-audit / Soteria-class static analysis; one internal red-team day on the frontend tx-building paths.
2. **External audit (pre-mainnet-funds at scale):** scope = program only (~1.2k LoC estimate). Target firms comfortable with Anchor (OtterSec, Neodyme, Sec3, Zellic tier). Directed focus: state-machine transitions, distribution math/remaining-accounts handling, PDA seed collisions, pause-asymmetry invariant.
3. **Bug bounty (public launch):** start modest (e.g. up to $25k crit) via a standard platform or self-run with a published policy.
4. **Invariant monitoring (backend):** alert on any `Distributed` event whose vault never passed through a full-length challenge, any state regression, or vault balance changes without matching events — a tripwire for "impossible" bugs.
5. **Launch caps:** soft UI cap suggesting ≤ some value per vault during beta; no hard on-chain cap (it would be paternalistic and trivially bypassed) — honesty in docs instead.

## 6. Incident response (pre-written now, because inheritance ≠ downtime tolerance)

- Severity 1 (funds at risk): pause new intake via `paused`; publish signed statement; upgrade path decision via multisig within 24h. Note: if the program is frozen by then, response = disclosure + guided withdrawal, which still works because owner withdrawal can never be broken by anyone — that invariant is the whole point.
- Contact: security@ published + `security.txt`; PGP key in repo.
