use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::events::ClaimInitiated;
use crate::state::{Vault, VaultState};

#[derive(Accounts)]
pub struct InitiateClaim<'info> {
    pub claimer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

pub fn initiate_claim_handler(ctx: Context<InitiateClaim>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::Active)?;

    let claimer = ctx.accounts.claimer.key();
    require!(vault.is_beneficiary(&claimer), PolError::NotBeneficiary);

    let now = Clock::get()?.unix_timestamp;
    require!(
        vault.inactivity_elapsed(now)?,
        PolError::InactivityPeriodNotElapsed
    );

    vault.state = VaultState::InChallenge;
    vault.claim_initiated_at = now;
    vault.claimer = claimer;

    let challenge_ends_at = now
        .checked_add(vault.challenge_period)
        .ok_or(PolError::MathOverflow)?;

    emit!(ClaimInitiated {
        vault: vault.key(),
        owner: vault.owner,
        claimer,
        challenge_ends_at,
        timestamp: now,
    });
    Ok(())
}
