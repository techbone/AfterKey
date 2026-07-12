# Smart Contract Design — `proof_of_life` Anchor Program

## 1. Framework decision: Anchor — yes

Raw Solana programs save a few hundred bytes and some CU, none of which matters at our throughput. Anchor buys us: declarative signer/owner/PDA validation (the exploit classes that kill Solana protocols), discriminators preventing account-type confusion, an IDL for typed clients, `anchor test` harness, and auditor familiarity. Use latest stable (0.31.x), `#[account]` zero-copy not needed at our account sizes.

## 2. Design tenets

1. **Owner sovereignty:** while `Active`, the owner can do anything, including withdraw 100% instantly. The protocol adds no restriction on a living owner.
2. **Time + silence are the only release conditions.** No instruction, signer, or authority (including us) can release funds early.
3. **Permissionless completion:** once conditions are met, anyone can finalize and distribute — beneficiaries never depend on our infrastructure.
4. **Small state machine, exhaustively tested.** Four states, every transition guarded by explicit `require!`s.

## 3. State machine

```
                    initialize_vault
                          │
                          ▼
              ┌───────► Active ◄──────────────┐
              │           │                   │
   veto_claim │           │ initiate_claim    │ (owner withdraw during
   (owner)    │           │ (beneficiary,     │  challenge = auto-veto)
              │           │  now > last_checkin + inactivity_period)
              │           ▼                   │
              └────── InChallenge ────────────┘
                          │
                          │ finalize_claim (anyone,
                          │  now > claim_initiated_at + challenge_period)
                          ▼
                       Released
                          │ distribute (anyone, per mint) … then close
                          ▼
                        Closed  ◄── close_vault (owner, from Active, empty)
```

Liveness rule: **every owner-signed instruction on the vault sets `last_checkin = now`** (check_in, deposit, withdraw, update_config, veto_claim). `check_in` exists as the zero-side-effect version.

## 4. Accounts & PDAs

### 4.1 `Config` — singleton
- **Seeds:** `["config"]`
- **Fields:** `admin: Pubkey` (Squads multisig), `paused: bool`, `min_inactivity_secs: i64`, `min_challenge_secs: i64`, `bump: u8`
- `paused` blocks only `initialize_vault` and deposits (new risk intake) — **never** check-ins, vetoes, withdrawals, or claim flow. A malicious/compromised admin must not be able to stop an owner proving life or withdrawing, nor stop a legitimate inheritance. This asymmetry is deliberate and audit-critical.

### 4.2 `Vault` — one per (owner, vault_id)
- **Seeds:** `["vault", owner: Pubkey, vault_id: u64 (le bytes)]`
- **Fields:**

| Field | Type | Notes |
|---|---|---|
| `owner` | `Pubkey` | immutable after init |
| `vault_id` | `u64` | allows multiple vaults per owner |
| `bump` | `u8` | stored, always used in seeds |
| `state` | `VaultState` enum {Active, InChallenge, Released, Closed} | |
| `inactivity_period` | `i64` (secs) | ≥ `config.min_inactivity_secs` (mainnet: 30 days) |
| `challenge_period` | `i64` (secs) | ≥ `config.min_challenge_secs` (mainnet: 7 days; default UI 30) |
| `last_checkin` | `i64` unix | reset by every owner-signed ix |
| `claim_initiated_at` | `i64` | 0 unless InChallenge |
| `claimer` | `Pubkey` | who initiated the live claim (for events/UI) |
| `beneficiaries` | `Vec<Beneficiary>` max 10 | `Beneficiary { key: Pubkey, share_bps: u16 }` |
| `created_at` | `i64` | |

- **Size:** fixed allocation for max 10 beneficiaries → 8 (disc) + 32+8+1+1+8+8+8+8+32 + 4+10×34 + 8 ≈ **462 bytes**. Allocate max upfront; no realloc.
- **Why a Vec, not per-beneficiary PDAs:** 10 entries fit trivially; a single account makes share-sum validation atomic (`Σ share_bps == 10_000` checked on every update), distribution single-pass, and rent simple. Per-beneficiary PDAs are the post-MVP path if we ever exceed ~30 (transaction account limits then force multi-tx distribution anyway).

### 4.3 Asset custody
- **SOL:** held as lamports in a dedicated escrow PDA `["sol_escrow", vault]` (separating escrow from the state account avoids rent-exemption vs. balance accounting bugs on the Vault account itself).
- **SPL tokens:** standard ATAs owned by the **Vault PDA** (`get_associated_token_address(vault_pda, mint)`). Created on first deposit of each mint via the ATA program. The vault signs transfers out with `signer_seeds = ["vault", owner, vault_id, bump]`.
- Direct transfers into the vault ATA (bypassing `deposit_token`) are harmless — `distribute` reads live balances, so "surprise" deposits are inherited correctly.

## 5. Instructions

| # | Instruction | Signer | State req | Effect / guards |
|---|---|---|---|---|
| 1 | `initialize_vault(vault_id, inactivity_period, challenge_period, beneficiaries)` | owner | — | Validate periods ≥ config minimums; beneficiaries non-empty, ≤10, unique keys, none == owner, Σ=10_000; init Vault + sol_escrow; `last_checkin = now` |
| 2 | `check_in()` | owner | Active or InChallenge* | `last_checkin = now`. *In InChallenge it also acts as veto (below) — one mental model: "owner signature = alive" |
| 3 | `update_config(new_beneficiaries?, new_inactivity?, new_challenge?)` | owner | Active only | Same validation as init; resets `last_checkin` |
| 4 | `deposit_sol(amount)` / `deposit_token(amount)` | owner | Active (and not `config.paused`) | Transfer in; resets `last_checkin` |
| 5 | `withdraw_sol(amount)` / `withdraw_token(amount)` | owner | Active or InChallenge | Transfer out to owner; resets `last_checkin`; if InChallenge → auto-veto (state → Active, clear claim fields) |
| 6 | `initiate_claim()` | any listed beneficiary | Active | `require!(now > last_checkin + inactivity_period)`; state → InChallenge; set `claim_initiated_at = now`, `claimer` |
| 7 | `veto_claim()` | owner | InChallenge | state → Active; clear claim fields; `last_checkin = now` |
| 8 | `finalize_claim()` | **anyone** | InChallenge | `require!(now > claim_initiated_at + challenge_period)`; state → Released |
| 9 | `distribute_token(mint)` | **anyone** | Released | remaining_accounts = beneficiary ATAs in stored order; pay each `floor(balance × share/10_000)`, dust to last; close vault ATA when empty (rent → owner) |
| 10 | `distribute_sol()` | **anyone** | Released | same over sol_escrow lamports |
| 11 | `close_vault()` | owner | Active, all balances zero | Close Vault + escrow, rent → owner; state → Closed |
| 11b | `close_released_vault()` | **anyone** | Released, sol_escrow empty | Completes the lifecycle after distribution: closes the Vault account, rent → cranker. Empty-escrow guard prevents stranding SOL; token-ATA-empty guard is a pre-mainnet TODO (UI distributes all mints first). |
| 12 | `update_admin_config(...)` | config.admin (multisig) | — | Adjust minimums / pause flag / admin handover. Cannot touch any Vault fields |

Distribution notes: 10 SPL transfers + ATA validations fit comfortably in one transaction (~10×~6k CU for transfers plus overhead, well under the 1.4M CU cap; request compute budget explicitly anyway). Beneficiary ATAs are created idempotently by the cranker/claimer (`create_associated_token_account_idempotent`), payer = caller. If a beneficiary ATA is frozen/uncreatable for some mint, `distribute_token` for *that mint* fails as a whole — acceptable at MVP (retryable; funds never stuck for other mints); post-MVP: per-beneficiary claim-pull as fallback.

## 6. Events (Anchor `emit!`)

`VaultCreated`, `CheckedIn`, `ConfigUpdated`, `Deposited { mint, amount }`, `Withdrawn { mint, amount, auto_veto: bool }`, `ClaimInitiated { claimer, claimable_from }`, `ClaimVetoed`, `ClaimFinalized`, `Distributed { mint, total }`, `VaultClosed`. Every event carries `vault`, `owner`, `timestamp`. These are the backend's sole indexing input, so they must be complete enough to rebuild the DB from logs alone.

## 7. Time & clock

All timing uses `Clock::get()?.unix_timestamp` (validator-voted, drift historically well under a few minutes). Our minimum windows are ≥ 7 days = 604,800 s; a worst-case drift of even an hour is 0.6% of the smallest window — not a viable attack. Never use slot counts (variable slot times skew long durations). All arithmetic via `checked_add`; periods bounded ≤ 10 years to keep sums far from `i64` overflow.

## 8. Error taxonomy

`InvalidPeriod`, `TooManyBeneficiaries`, `SharesMustSum10000`, `DuplicateBeneficiary`, `OwnerCannotBeBeneficiary`, `NotOwner`, `NotBeneficiary`, `WrongState`, `InactivityPeriodNotElapsed`, `ChallengeNotElapsed`, `VaultNotEmpty`, `Paused`, `MathOverflow`. Every `require!` maps to exactly one; tests assert the specific error, not just failure.

## 9. Upgradeability & governance

- Deploy with upgrade authority = **Squads multisig** (2-of-3 at minimum: founder + one engineer + one external trusted party) from day one — never a hot wallet, even on devnet-that-becomes-mainnet muscle memory.
- The upgrade authority is our **single biggest trust assumption**: it can steal all funds via a malicious upgrade. Communicate it honestly; roadmap: after audit + 6 months incident-free, either freeze the program (set authority to None) and version via new deployments + opt-in migration, or move authority behind a timelocked governance process. Decision point at Milestone 7, biased toward **freeze** — inheritance software should be boring and immutable.
- No `realloc`, no account-version field needed for MVP (fixed layout); add a `version: u8` to Vault anyway (1 byte, cheap insurance for future migrations).

## 10. Testing requirements (gate for Milestone 2)

- **State machine exhaustive:** every instruction attempted from every state × every signer class (owner / beneficiary / stranger / admin) — matrix ≈ 12×4×4; invalid cells must fail with the exact expected error.
- **Time travel:** LiteSVM / bankrun-style clock warping for: claim exactly at boundary (off-by-one: `>` not `>=` semantics fixed and tested), veto at last second, finalize one second early (must fail).
- **Distribution properties:** fuzz share splits (proptest): Σ payouts == starting balance exactly (dust handling), no beneficiary paid twice, order-independence per mint.
- **Adversarial:** fake vault account substitution, wrong-mint ATA, beneficiary passing own ATA twice in remaining_accounts, claim from removed beneficiary, deposit-after-Released.
- Coverage isn't the metric; the transition/signer matrix at 100% is.
