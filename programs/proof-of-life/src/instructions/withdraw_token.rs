use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::state::Vault;

// STUB — Milestone 2 (smart-contracts.md §5 #5).
// Full context: mint, vault ATA, owner ATA, token program. Allowed in Active
// and InChallenge (auto-veto, like withdraw_sol); vault PDA signs with
// ["vault", owner, vault_id, bump]; closes the vault ATA when emptied
// (rent → owner) to prevent close_vault orphans; emits Withdrawn.
#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
}

pub fn withdraw_token_handler(_ctx: Context<WithdrawToken>, _amount: u64) -> Result<()> {
    err!(PolError::NotImplemented)
}
