use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, SOL_ESCROW_SEED, VAULT_SEED};
use crate::errors::PolError;
use crate::events::VaultCreated;
use crate::state::{validate_beneficiaries, validate_periods, Beneficiary, Config, Vault, VaultState};

#[derive(Accounts)]
#[instruction(vault_id: u64)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref(), &vault_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    /// Zero-data, system-owned lamport escrow (smart-contracts.md §4.3);
    /// existence is just its address — funded on first deposit.
    #[account(seeds = [SOL_ESCROW_SEED, vault.key().as_ref()], bump)]
    pub sol_escrow: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_vault_handler(
    ctx: Context<InitializeVault>,
    vault_id: u64,
    inactivity_period: i64,
    challenge_period: i64,
    beneficiaries: Vec<Beneficiary>,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, PolError::Paused);
    validate_periods(config, inactivity_period, challenge_period)?;
    validate_beneficiaries(&ctx.accounts.owner.key(), &beneficiaries)?;

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.vault_id = vault_id;
    vault.bump = ctx.bumps.vault;
    vault.sol_escrow_bump = ctx.bumps.sol_escrow;
    vault.version = Vault::VERSION;
    vault.state = VaultState::Active;
    vault.inactivity_period = inactivity_period;
    vault.challenge_period = challenge_period;
    vault.last_checkin = now;
    vault.claim_initiated_at = 0;
    vault.claimer = Pubkey::default();
    vault.beneficiaries = beneficiaries;
    vault.created_at = now;

    emit!(VaultCreated {
        vault: vault.key(),
        owner: vault.owner,
        vault_id,
        inactivity_period,
        challenge_period,
        timestamp: now,
    });
    Ok(())
}
