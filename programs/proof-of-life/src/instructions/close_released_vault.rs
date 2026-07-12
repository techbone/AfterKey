use anchor_lang::prelude::*;

use crate::constants::SOL_ESCROW_SEED;
use crate::errors::PolError;
use crate::events::VaultClosed;
use crate::state::{Vault, VaultState};

// Permissionless final step: once a Released vault has been fully distributed
// (escrow empty), anyone can close it — completing the lifecycle shown in
// smart-contracts.md §3 (…→ Released → distribute → Closed). The Vault
// account's rent goes to whoever finishes it (the cranker/heir), same
// incentive as distribute closing drained token ATAs.
#[derive(Accounts)]
pub struct CloseReleasedVault<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(mut, close = cranker)]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
}

pub fn close_released_vault_handler(ctx: Context<CloseReleasedVault>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    vault.assert_state(VaultState::Released)?;
    // Empty-escrow guard prevents closing before SOL is distributed (which
    // would strand it). Does NOT yet verify token ATAs are empty — the UI
    // distributes every mint before calling this, and is SOL-only today.
    // Pre-mainnet hardening: require remaining_accounts proving each vault ATA
    // is closed. Tracked in smart-contracts.md §10.
    require!(ctx.accounts.sol_escrow.lamports() == 0, PolError::VaultNotEmpty);

    let now = Clock::get()?.unix_timestamp;
    emit!(VaultClosed {
        vault: vault.key(),
        owner: vault.owner,
        timestamp: now,
    });
    Ok(())
}
