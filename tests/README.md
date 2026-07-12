# Program tests (Milestone 2)

Layout per repo-blueprint.md §4 — LiteSVM-based, table-driven:

- `state-matrix/` — every instruction × every state × every signer class; invalid cells assert the exact PolError code
- `time-travel/` — clock-warp boundary tests (claim/finalize at deadline ±1s)
- `distribution/` — property tests: Σ payouts == balance, dust to last, idempotency
- `adversarial/` — account substitution, duplicate remaining_accounts, removed-beneficiary claims

Authoritative test list: docs/smart-contracts.md §10. The full matrix at 100% is the Milestone 2 gate.
