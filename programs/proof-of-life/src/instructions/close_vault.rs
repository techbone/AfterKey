use anchor_lang::prelude::*;

use crate::constants::SOL_ESCROW_SEED;
use crate::errors::PolError;
use crate::events::VaultClosed;
use crate::state::{Vault, VaultState};

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner, close = owner)]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
}

pub fn close_vault_handler(ctx: Context<CloseVault>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    vault.assert_state(VaultState::Active)?;
    require!(ctx.accounts.sol_escrow.lamports() == 0, PolError::VaultNotEmpty);
    // TODO(M2): guard against orphaned vault token ATAs — closing the Vault
    // account while a vault ATA still holds tokens strands those funds
    // (withdraw_token requires the Vault account). Plan: withdraw_token
    // closes emptied ATAs; close_vault verifies via remaining_accounts.
    // Tracked in smart-contracts.md §10 adversarial list.

    let now = Clock::get()?.unix_timestamp;
    emit!(VaultClosed {
        vault: vault.key(),
        owner: vault.owner,
        timestamp: now,
    });
    Ok(())
}
