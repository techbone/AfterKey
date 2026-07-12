use anchor_lang::prelude::*;

use crate::events::ClaimVetoed;
use crate::instructions::shared::OwnerVault;
use crate::state::VaultState;

pub fn veto_claim_handler(ctx: Context<OwnerVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.assert_state(VaultState::InChallenge)?;

    let now = Clock::get()?.unix_timestamp;
    vault.clear_claim();
    vault.state = VaultState::Active;
    vault.last_checkin = now;

    emit!(ClaimVetoed {
        vault: vault.key(),
        owner: vault.owner,
        auto_veto: false,
        timestamp: now,
    });
    Ok(())
}
