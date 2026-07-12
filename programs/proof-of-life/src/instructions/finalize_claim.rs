use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::events::ClaimFinalized;
use crate::state::{Vault, VaultState};

// Permissionless by design (prd.md F3): inheritance completes even if the
// company, the claimer, and every beneficiary's technical helper are gone.
#[derive(Accounts)]
pub struct FinalizeClaim<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

pub fn finalize_claim_handler(ctx: Context<FinalizeClaim>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::InChallenge)?;

    let now = Clock::get()?.unix_timestamp;
    require!(vault.challenge_elapsed(now)?, PolError::ChallengeNotElapsed);

    vault.state = VaultState::Released;

    emit!(ClaimFinalized {
        vault: vault.key(),
        owner: vault.owner,
        claimer: vault.claimer,
        timestamp: now,
    });
    Ok(())
}
