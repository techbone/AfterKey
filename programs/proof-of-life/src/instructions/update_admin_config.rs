use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::state::Config;

#[derive(Accounts)]
pub struct UpdateAdminConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

// Admin (Squads multisig) can pause NEW risk intake and tune minimums —
// and can never touch a Vault. The blast radius of a hostile admin is
// bounded by design (smart-contracts.md §4.1).
pub fn update_admin_config_handler(
    ctx: Context<UpdateAdminConfig>,
    paused: Option<bool>,
    min_inactivity_secs: Option<i64>,
    min_challenge_secs: Option<i64>,
    new_admin: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    if let Some(p) = paused {
        config.paused = p;
    }
    if let Some(v) = min_inactivity_secs {
        config.min_inactivity_secs = v;
    }
    if let Some(v) = min_challenge_secs {
        config.min_challenge_secs = v;
    }
    if let Some(a) = new_admin {
        config.admin = a;
    }
    Ok(())
}
