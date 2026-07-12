use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, DEFAULT_MIN_CHALLENGE_SECS, DEFAULT_MIN_INACTIVITY_SECS};
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

// First caller becomes admin — MUST be executed by the Squads multisig in the
// same deploy ceremony as the program itself (repo-blueprint.md §3); the
// deploy runbook treats an unclaimed config as a critical failure.
pub fn initialize_config_handler(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.paused = false;
    config.min_inactivity_secs = DEFAULT_MIN_INACTIVITY_SECS;
    config.min_challenge_secs = DEFAULT_MIN_CHALLENGE_SECS;
    config.bump = ctx.bumps.config;
    Ok(())
}
