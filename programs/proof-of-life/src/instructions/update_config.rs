use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::PolError;
use crate::events::ConfigUpdated;
use crate::state::{validate_beneficiaries, validate_periods, Beneficiary, Config, Vault, VaultState};

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
}

// Active only — config is frozen during a challenge (prd.md F4): the owner's
// sole moves mid-challenge are veto/check-in/withdraw.
pub fn update_config_handler(
    ctx: Context<UpdateConfig>,
    new_beneficiaries: Option<Vec<Beneficiary>>,
    new_inactivity_period: Option<i64>,
    new_challenge_period: Option<i64>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::Active)?;

    let inactivity = new_inactivity_period.unwrap_or(vault.inactivity_period);
    let challenge = new_challenge_period.unwrap_or(vault.challenge_period);
    validate_periods(&ctx.accounts.config, inactivity, challenge)?;
    vault.inactivity_period = inactivity;
    vault.challenge_period = challenge;

    let beneficiaries_changed = new_beneficiaries.is_some();
    if let Some(list) = new_beneficiaries {
        validate_beneficiaries(&vault.owner, &list)?;
        vault.beneficiaries = list;
    }

    let now = Clock::get()?.unix_timestamp;
    vault.last_checkin = now;

    // The indexer turns beneficiaries_changed into the non-disableable
    // security tripwire email (attack-tree.md top risk #1).
    emit!(ConfigUpdated {
        vault: vault.key(),
        owner: vault.owner,
        beneficiaries_changed,
        timestamp: now,
    });
    Ok(())
}
