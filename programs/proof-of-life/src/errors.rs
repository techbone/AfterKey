use anchor_lang::prelude::*;

// One variant per require! — tests assert exact codes (smart-contracts.md §8).
#[error_code]
pub enum PolError {
    #[msg("Inactivity or challenge period is outside allowed bounds")]
    InvalidPeriod,
    #[msg("At least one beneficiary is required")]
    NoBeneficiaries,
    #[msg("A vault supports at most 10 beneficiaries")]
    TooManyBeneficiaries,
    #[msg("Beneficiary shares must sum to exactly 10000 basis points")]
    SharesMustSum10000,
    #[msg("Duplicate beneficiary key")]
    DuplicateBeneficiary,
    #[msg("The owner cannot be a beneficiary")]
    OwnerCannotBeBeneficiary,
    #[msg("Signer is not the vault owner")]
    NotOwner,
    #[msg("Signer is not a listed beneficiary")]
    NotBeneficiary,
    #[msg("Instruction not allowed in the vault's current state")]
    WrongState,
    #[msg("The inactivity period has not elapsed")]
    InactivityPeriodNotElapsed,
    #[msg("The challenge period has not elapsed")]
    ChallengeNotElapsed,
    #[msg("Vault must be empty before closing")]
    VaultNotEmpty,
    #[msg("Insufficient vault balance")]
    InsufficientFunds,
    #[msg("New vaults and deposits are paused")]
    Paused,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Not yet implemented (Milestone 2)")]
    NotImplemented,
}
