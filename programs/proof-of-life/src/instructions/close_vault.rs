use anchor_lang::prelude::*;

use crate::constants::SOL_ESCROW_SEED;
use crate::errors::PolError;
use crate::events::VaultClosed;
use crate::state::{Vault, VaultState};

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
}

pub fn close_vault_handler(ctx: Context<CloseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::Active)?;
    require!(ctx.accounts.sol_escrow.lamports() == 0, PolError::VaultNotEmpty);
    // A caller cannot prove the absence of every possible SPL account.
    // Retain this authority record instead of deallocating it. Cancellation
    // permanently prevents claims while allowing the owner to recover tokens.
    // Rent remains in the record; it is not refunded on logical closure.
    vault.clear_claim();
    vault.state = VaultState::Closed;

    let now = Clock::get()?.unix_timestamp;
    emit!(VaultClosed {
        vault: vault.key(),
        owner: vault.owner,
        timestamp: now,
    });
    Ok(())
}
