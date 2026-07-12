use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::state::Vault;

// STUB — Milestone 2 (smart-contracts.md §5 #9).
// Permissionless crank, mirrors distribute_sol: remaining_accounts =
// beneficiary ATAs in stored order, each validated by deriving the ATA from
// the STORED beneficiary key + mint (never caller-supplied addresses —
// attack-tree.md G2.3); floor division with dust to last; closes the vault
// ATA when drained; emits Distributed. Requires anchor-spl (added in M2).
#[derive(Accounts)]
pub struct DistributeToken<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

pub fn distribute_token_handler(_ctx: Context<DistributeToken>) -> Result<()> {
    err!(PolError::NotImplemented)
}
