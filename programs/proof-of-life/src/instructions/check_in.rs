use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::events::{CheckedIn, ClaimVetoed};
use crate::instructions::shared::OwnerVault;
use crate::state::VaultState;

// One mental model everywhere: "owner signature = alive". During a challenge
// a plain check-in therefore also vetoes (smart-contracts.md §5 #2).
pub fn check_in_handler(ctx: Context<OwnerVault>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    match vault.state {
        VaultState::Active => {}
        VaultState::InChallenge => {
            vault.clear_claim();
            vault.state = VaultState::Active;
            emit!(ClaimVetoed {
                vault: vault.key(),
                owner: vault.owner,
                auto_veto: true,
                timestamp: now,
            });
        }
        _ => return err!(PolError::WrongState),
    }

    vault.last_checkin = now;
    emit!(CheckedIn {
        vault: vault.key(),
        owner: vault.owner,
        timestamp: now,
    });
    Ok(())
}
