# Attack Tree — AfterKey

Formal enumeration of paths to each adversary goal. Notation: **OR** children = any path suffices; **AND** children = all required. Each leaf is tagged `[likelihood/impact]` (L/M/H) and cross-referenced to mitigations in [security.md](security.md).

## Goal 1: Steal vault assets before legitimate release (early release / theft)

```
G1. Extract assets while owner is alive and unwilling
├── OR 1.1 Compromise the owner's key                      [M/H]
│   ├── OR 1.1.1 Phishing owner into signing withdraw/update_config  [M/H]
│   │   ├── 1.1.1.a Fake "AfterKey" emails with tx links   → mitig: no links in emails, DKIM/DMARC (sec §3.6)
│   │   ├── 1.1.1.b Compromised frontend builds malicious tx    → mitig: CI supply-chain checks, CSP, wallet simulation
│   │   └── 1.1.1.c Fake support / Discord DMs                  → mitig: comms policy, in-app warnings
│   ├── 1.1.2 Malware/seed theft (generic wallet compromise)    [M/H] → out of protocol scope; hardware-wallet guidance
│   └── 1.1.3 Stolen key + PATIENT attacker: swap beneficiaries,
│             wait out inactivity period silently               [L/H] → mitig (post-MVP): beneficiary-change timelock + change notifications; MVP: change events emailed immediately
├── OR 1.2 Break the program
│   ├── 1.2.1 Missing signer/owner check on a mutating ix       [L/H] → Anchor constraints + signer-matrix tests + audit
│   ├── 1.2.2 Account substitution (fake vault/ATA/mint)        [L/H] → PDA derivation checks, has_one, ATA address checks + adversarial tests
│   ├── 1.2.3 State-machine bypass (e.g. finalize from Active)  [L/H] → exhaustive transition tests
│   ├── 1.2.4 Distribution math (overflow, double-pay via
│   │         duplicate remaining_accounts)                     [M/H] → checked math, dedupe/ordered-ATA validation, proptest invariants
│   └── 1.2.5 Boundary off-by-one lets claim 1s early           [M/L] → explicit boundary tests (impact low: 1s vs 30d)
├── OR 1.3 Malicious program upgrade                            [L/H]
│   ├── AND 1.3.1 Compromise ≥2 of 3 Squads signers             → key ceremony, hardware wallets, geographic split
│   └── alt 1.3.2 Social-engineer a "critical patch" through the multisig → written upgrade policy w/ mandatory review delay
├── OR 1.4 Manipulate time
│   └── 1.4.1 Skew Clock sysvar by weeks                        [~0/H] → requires validator-supermajority collusion; accepted
└── OR 1.5 Coerce the owner physically ($5 wrench)              [L/H] → out of scope; note: vault is NO WORSE than plain wallet, and long timers make coerced beneficiary-swaps detectable via change alerts
```

## Goal 2: Steal or redirect a legitimate inheritance (attack the beneficiaries)

```
G2. Divert assets after owner death
├── OR 2.1 Compromise a beneficiary key before distribution     [M/M]
│   └── mitig: owner can rotate beneficiary keys anytime while alive; post-death, race is real → guidance: beneficiaries use hardware wallets; post-MVP fallback addresses
├── OR 2.2 Phish beneficiary during claim flow (fake claim site) [M/M]
│   └── mitig: claim ix only moves funds to ON-CHAIN-STORED beneficiary keys — a phished signature can initiate/finalize but CANNOT redirect. Redirect requires 2.1. This containment is a core design win: distribution targets are never caller-supplied.
├── OR 2.3 Front-run distribute with substituted ATAs           [L/H]
│   └── mitig: distribute derives each beneficiary's ATA from stored pubkey + mint; remaining_accounts are validated against derivation, not trusted
└── OR 2.4 Our cranker misbehaves                                [L/-]
    └── no capability: cranker holds no authority; worst case it does nothing → anyone else cranks
```

## Goal 3: Prevent or delay legitimate inheritance (denial)

```
G3. Beneficiaries never receive assets
├── OR 3.1 Company disappears                                   [M/M]
│   └── mitig: permissionless finalize/distribute; docs include a "claim via CLI" runbook published publicly (repo-blueprint.md)
├── OR 3.2 Backend/notifications die silently → beneficiaries never learn vault exists [M/M]
│   └── mitig: owner is told to inform beneficiaries out-of-band at setup (UI checklist + printable "inheritance letter" PDF with vault address); beneficiary-facing lookup page needs only a pubkey + public RPC
├── OR 3.3 Admin abuses `paused`                                [L/L]
│   └── contained by design: pause cannot block claim flow or withdrawals (sec §3.6)
├── OR 3.4 Grief: attacker repeatedly... nothing. Strangers cannot veto; only the owner can. No third-party denial lever exists on the claim path. ✓ (design invariant to preserve in every future change)
└── OR 3.5 Beneficiary loses own key after owner death           [M/M]
    └── residual; post-MVP fallback addresses / per-beneficiary reassignment window
```

## Goal 4: Grief owners (cost/annoyance without theft)

```
G4. Impose cost on living owners
├── 4.1 Premature claim spam by a listed beneficiary            [M/L]
│   └── requires vault already claimable (owner silent for months); veto ≈ free; repeated abuse → owner removes beneficiary; post-MVP cooldown if observed
├── 4.2 Dust-token spam to vault ATAs                            [H/L] → curated token list UI; per-mint distribution isolates junk
├── 4.3 Notification-bomb: fake claims to trigger owner panic    [M/L] → only listed beneficiaries can claim; strangers have no claim ix path
└── 4.4 Rent-drain via forced account creation                   [L/L] → all init instructions payer = caller, never the vault
```

## Goal 5: Systemic / governance attacks

```
G5. Attack the protocol as an institution
├── 5.1 Upgrade-authority capture (= G1.3)                       [L/H] → freeze roadmap is the terminal mitigation
├── 5.2 Fake fork of frontend at lookalike domain                [M/M] → publish canonical domains on-chain in Config metadata (post-MVP), trademark, takedowns
├── 5.3 Regulatory: protocol construed as unlicensed fiduciary/estate service [M/M]
│   └── mitig: non-custodial architecture is the defense; legal memo before public launch (roadmap M6); ToS: software, not estate planning; no fee at MVP keeps posture cleanest
└── 5.4 Reputational: one high-profile false release ends the company [L/H]
    └── this is why security.md ranks integrity above liveness, why defaults are conservative (30d challenge), and why beta launches with soft caps
```

## Top 5 risks by expected damage (for prioritization)

1. **1.1.3 / G1.1 patient-attacker beneficiary swap after key compromise** → build beneficiary-change alerts into MVP backend (cheap), timelock post-MVP.
2. **1.3 malicious upgrade** → multisig hygiene now, freeze decision at M7.
3. **3.2 beneficiaries never learn the vault exists** → setup checklist + printable inheritance letter in MVP UI (cheap, high value).
4. **1.2.4 distribution bugs** → proptest invariants + audit focus.
5. **5.4 false-release reputation event** → conservative defaults, invariant monitoring tripwires (security.md §5.4).
