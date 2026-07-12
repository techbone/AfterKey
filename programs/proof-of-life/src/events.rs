use anchor_lang::prelude::*;

// Every event carries vault + owner + timestamp: the backend indexer rebuilds
// its entire DB from these alone (smart-contracts.md §6, backend.md §5).
// `mint == Pubkey::default()` is the sentinel for native SOL.

#[event]
pub struct VaultCreated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub vault_id: u64,
    pub inactivity_period: i64,
    pub challenge_period: i64,
    pub timestamp: i64,
}

#[event]
pub struct CheckedIn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ConfigUpdated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub beneficiaries_changed: bool,
    pub timestamp: i64,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub auto_veto: bool,
    pub timestamp: i64,
}

#[event]
pub struct ClaimInitiated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub claimer: Pubkey,
    pub challenge_ends_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct ClaimVetoed {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub auto_veto: bool,
    pub timestamp: i64,
}

#[event]
pub struct ClaimFinalized {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub claimer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct Distributed {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub total: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultClosed {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}
