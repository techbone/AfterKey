use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::state::Vault;

// STUB — Milestone 2 (smart-contracts.md §5 #4).
// Full context: config (pause check), mint, owner ATA, vault ATA
// (init_if_needed, authority = vault PDA), token program. Transfers via
// token::transfer_checked; resets last_checkin; emits Deposited.
#[derive(Accounts)]
pub struct DepositToken<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
}

pub fn deposit_token_handler(_ctx: Context<DepositToken>, _amount: u64) -> Result<()> {
    err!(PolError::NotImplemented)
}
