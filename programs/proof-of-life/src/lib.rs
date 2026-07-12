//! Proof of Life — non-custodial crypto inheritance on Solana.
//!
//! Dead-man's switch: assets release to owner-chosen beneficiaries only after
//! a configurable inactivity period AND an unanswered challenge window.
//! Design source of truth: docs/smart-contracts.md.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::Beneficiary;

declare_id!("6njwUjht6L2si9uEoPJHgYwXskMCx7P1Po5DuSYbFPvP");

#[program]
pub mod proof_of_life {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config::initialize_config_handler(ctx)
    }

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_id: u64,
        inactivity_period: i64,
        challenge_period: i64,
        beneficiaries: Vec<Beneficiary>,
    ) -> Result<()> {
        instructions::initialize_vault::initialize_vault_handler(
            ctx,
            vault_id,
            inactivity_period,
            challenge_period,
            beneficiaries,
        )
    }

    pub fn check_in(ctx: Context<OwnerVault>) -> Result<()> {
        instructions::check_in::check_in_handler(ctx)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_beneficiaries: Option<Vec<Beneficiary>>,
        new_inactivity_period: Option<i64>,
        new_challenge_period: Option<i64>,
    ) -> Result<()> {
        instructions::update_config::update_config_handler(
            ctx,
            new_beneficiaries,
            new_inactivity_period,
            new_challenge_period,
        )
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol::deposit_sol_handler(ctx, amount)
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        instructions::withdraw_sol::withdraw_sol_handler(ctx, amount)
    }

    pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
        instructions::deposit_token::deposit_token_handler(ctx, amount)
    }

    pub fn withdraw_token(ctx: Context<WithdrawToken>, amount: u64) -> Result<()> {
        instructions::withdraw_token::withdraw_token_handler(ctx, amount)
    }

    pub fn initiate_claim(ctx: Context<InitiateClaim>) -> Result<()> {
        instructions::initiate_claim::initiate_claim_handler(ctx)
    }

    pub fn veto_claim(ctx: Context<OwnerVault>) -> Result<()> {
        instructions::veto_claim::veto_claim_handler(ctx)
    }

    pub fn finalize_claim(ctx: Context<FinalizeClaim>) -> Result<()> {
        instructions::finalize_claim::finalize_claim_handler(ctx)
    }

    pub fn distribute_sol<'info>(
        ctx: Context<'_, '_, 'info, 'info, DistributeSol<'info>>,
    ) -> Result<()> {
        instructions::distribute_sol::distribute_sol_handler(ctx)
    }

    pub fn distribute_token(ctx: Context<DistributeToken>) -> Result<()> {
        instructions::distribute_token::distribute_token_handler(ctx)
    }

    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        instructions::close_vault::close_vault_handler(ctx)
    }

    pub fn update_admin_config(
        ctx: Context<UpdateAdminConfig>,
        paused: Option<bool>,
        min_inactivity_secs: Option<i64>,
        min_challenge_secs: Option<i64>,
        new_admin: Option<Pubkey>,
    ) -> Result<()> {
        instructions::update_admin_config::update_admin_config_handler(
            ctx,
            paused,
            min_inactivity_secs,
            min_challenge_secs,
            new_admin,
        )
    }
}
