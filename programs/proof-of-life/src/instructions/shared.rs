use anchor_lang::prelude::*;

use crate::errors::PolError;
use crate::state::Vault;

/// Owner-signed access to a vault — used by check_in and veto_claim.
/// `has_one` binds the signer to the vault's stored owner; the vault's own
/// address (a typed, program-owned account) is its identity, so no seeds
/// re-derivation is needed here.
#[derive(Accounts)]
pub struct OwnerVault<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
}
