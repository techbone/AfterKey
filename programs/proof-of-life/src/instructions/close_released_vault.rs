use anchor_lang::prelude::*;

use crate::constants::SOL_ESCROW_SEED;
use crate::errors::PolError;
use crate::events::VaultClosed;
use crate::state::{Vault, VaultState};

// Permissionless logical closure after SOL distribution. Retain the authority
// record and claimer so omitted or subsequently received assets can still be
// distributed to beneficiaries, never reclaimed by the owner. Rent stays in
// the record. Token ATAs still refund rent when distribution closes them.
#[derive(Accounts)]
pub struct CloseReleasedVault<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
}

pub fn close_released_vault_handler(ctx: Context<CloseReleasedVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::Released)?;
    require!(ctx.accounts.sol_escrow.lamports() == 0, PolError::VaultNotEmpty);
    vault.state = VaultState::Closed;

    let now = Clock::get()?.unix_timestamp;
    emit!(VaultClosed {
        vault: vault.key(),
        owner: vault.owner,
        timestamp: now,
    });
    Ok(())
}
