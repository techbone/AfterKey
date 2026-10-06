use anchor_lang::prelude::*;

use crate::constants::{MAX_BENEFICIARIES, TOTAL_SHARE_BPS};
use crate::errors::PolError;

#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Squads multisig in production (smart-contracts.md §4.1).
    pub admin: Pubkey,
    /// Blocks ONLY initialize_vault + deposits — never check-ins, vetoes,
    /// withdrawals, or the claim flow. Audit-critical asymmetry.
    pub paused: bool,
    pub min_inactivity_secs: i64,
    pub min_challenge_secs: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultState {
    Active,
    InChallenge,
    Released,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct Beneficiary {
    pub key: Pubkey,
    pub share_bps: u16,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub vault_id: u64,
    pub bump: u8,
    pub sol_escrow_bump: u8,
    /// Layout version — cheap insurance for future migrations.
    pub version: u8,
    pub state: VaultState,
    pub inactivity_period: i64,
    pub challenge_period: i64,
    /// Reset by EVERY owner-signed instruction on this vault.
    pub last_checkin: i64,
    /// 0 unless state == InChallenge.
    pub claim_initiated_at: i64,
    /// Pubkey::default() unless state == InChallenge.
    pub claimer: Pubkey,
    #[max_len(10)]
    pub beneficiaries: Vec<Beneficiary>,
    pub created_at: i64,
}

impl Vault {
    pub const VERSION: u8 = 1;

    pub fn assert_state(&self, expected: VaultState) -> Result<()> {
        require!(self.state == expected, PolError::WrongState);
        Ok(())
    }

    pub fn is_beneficiary(&self, key: &Pubkey) -> bool {
        self.beneficiaries.iter().any(|b| b.key == *key)
    }

    /// Closed vaults retain their authority record so unsolicited or omitted
    /// SPL deposits remain recoverable. A successful inheritance retains its
    /// non-default claimer; owner cancellation clears it. Never let the owner
    /// recover assets that have already been released to beneficiaries.
    pub fn inheritance_released(&self) -> bool {
        self.state == VaultState::Released
            || (self.state == VaultState::Closed && self.claimer != Pubkey::default())
    }

    pub fn owner_cancelled(&self) -> bool {
        self.state == VaultState::Closed && self.claimer == Pubkey::default()
    }

    /// Strictly after the deadline: claimable at last_checkin + period + 1s
    /// (boundary semantics tested explicitly — smart-contracts.md §10).
    pub fn inactivity_elapsed(&self, now: i64) -> Result<bool> {
        let deadline = self
            .last_checkin
            .checked_add(self.inactivity_period)
            .ok_or(PolError::MathOverflow)?;
        Ok(now > deadline)
    }

    pub fn challenge_elapsed(&self, now: i64) -> Result<bool> {
        let deadline = self
            .claim_initiated_at
            .checked_add(self.challenge_period)
            .ok_or(PolError::MathOverflow)?;
        Ok(now > deadline)
    }

    pub fn clear_claim(&mut self) {
        self.claim_initiated_at = 0;
        self.claimer = Pubkey::default();
    }
}

/// Shared by initialize_vault and update_config — validation must be
/// identical everywhere beneficiaries are written (smart-contracts.md §5).
pub fn validate_beneficiaries(owner: &Pubkey, list: &[Beneficiary]) -> Result<()> {
    require!(!list.is_empty(), PolError::NoBeneficiaries);
    require!(list.len() <= MAX_BENEFICIARIES, PolError::TooManyBeneficiaries);

    let mut sum: u32 = 0;
    for (i, b) in list.iter().enumerate() {
        require!(b.key != *owner, PolError::OwnerCannotBeBeneficiary);
        require!(
            !list[..i].iter().any(|prev| prev.key == b.key),
            PolError::DuplicateBeneficiary
        );
        sum += b.share_bps as u32;
    }
    require!(sum == TOTAL_SHARE_BPS as u32, PolError::SharesMustSum10000);
    Ok(())
}

pub fn validate_periods(
    config: &Config,
    inactivity_period: i64,
    challenge_period: i64,
) -> Result<()> {
    require!(
        inactivity_period >= config.min_inactivity_secs
            && inactivity_period <= crate::constants::MAX_PERIOD_SECS,
        PolError::InvalidPeriod
    );
    require!(
        challenge_period >= config.min_challenge_secs
            && challenge_period <= crate::constants::MAX_PERIOD_SECS,
        PolError::InvalidPeriod
    );
    Ok(())
}
