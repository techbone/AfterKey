# Vault closure and recovery

This source change deliberately retains a small `Closed` vault account instead of deallocating it. The account layout, state enum and instruction discriminators remain unchanged; no new remaining-account proof is required.

## Why retention is necessary

The vault can control associated token accounts for arbitrary SPL mints. Neither the SOL escrow balance nor an optional caller-provided mint list proves that no other token account exists. Removing the vault account removes the authority/configuration required by its recovery instructions. Checking the web interface's token list does not enforce safety on-chain.

The retained record solves the missing-account problem, including when the caller omits a mint or tokens arrive through external ATA transfers after closure. It trades rent reclamation for continued recoverability. It does not add support for Token-2022 or arbitrary non-associated token accounts.

## Authority invariant

| Closed record | Claim marker | Remaining SOL / SPL ATA rights |
| --- | --- | --- |
| Owner cancellation | `claimer == Pubkey::default()` | Owner-only withdrawals |
| Completed inheritance | `claimer != Pubkey::default()` | Permissionless distribution to stored beneficiaries |

`initiate_claim` sets the claimer from a signer; successful finalization preserves it. Check-in/veto clears it while returning the vault to Active. Owner closure requires Active and explicitly clears it. Released closure preserves it. Every Closed record rejects new claims, configuration changes, check-ins, vetoes and protocol deposits. Recovery does not reactivate it or change its recipients.

The signer requirement prevents the default system-program pubkey from becoming a valid inheritance claimer. The frontend additionally rejects that reserved address and non-signing PDA addresses when choosing beneficiaries.

## Regression coverage

- Cancellation with a funded SPL ATA, followed by successful owner recovery.
- External ATA transfers after owner cancellation, followed by recovery.
- Released closure before token distribution, followed by correct beneficiary payouts.
- An omitted second mint arriving after inheritance completion, still distributed by stored shares.
- Owner withdrawal/check-in/veto rejection after inheritance completion.
- Subsequent SOL transfers after either closure mode, recovered by the appropriate party.
- Atomic create/deposit rollback, challenge cancellation with zero and nonzero SOL, and finalize/payout/closure rollback on a substituted beneficiary.
- Maximum ten-beneficiary atomic creation and payout under the transaction packet limit.

## Deployment and operations

Changing the website alone does not update program behavior. The October 6 devnet rollout deployed this policy at a fresh address after loss of the original upgrade key; see [devnet-deployment.json](devnet-deployment.json). Old vaults remain under the original program, with no automatic migration or new recovery rights. The patch preserves instruction and account layouts, so an authorized upgrade in place would have supported existing records. Build the intended timing variant and compare its bytes with the public deployment using `npm run check:deploy` after any later upgrade.

Records already deallocated by the previous program cannot be recovered through this change. The frontend must not promise a vault-account rent refund under the updated behavior. Token ATA rent still returns when `withdraw_token` or `distribute_token` closes an emptied ATA.

The README and this document supersede older descriptions of closure/rent refunds in the design archive. A future rent reclamation feature requires a separate design that preserves arbitrary-mint recovery; do not reintroduce deallocation based on caller-supplied enumeration alone.
