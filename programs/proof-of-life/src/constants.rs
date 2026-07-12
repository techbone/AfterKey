pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const SOL_ESCROW_SEED: &[u8] = b"sol_escrow";

pub const MAX_BENEFICIARIES: usize = 10;
pub const TOTAL_SHARE_BPS: u16 = 10_000;

/// Upper bound on both periods — keeps `last_checkin + inactivity_period`
/// far from i64 overflow (smart-contracts.md §7).
pub const MAX_PERIOD_SECS: i64 = 10 * 365 * 24 * 60 * 60;

#[cfg(not(feature = "devnet-timing"))]
pub const DEFAULT_MIN_INACTIVITY_SECS: i64 = 30 * 24 * 60 * 60; // 30 days
#[cfg(not(feature = "devnet-timing"))]
pub const DEFAULT_MIN_CHALLENGE_SECS: i64 = 7 * 24 * 60 * 60; // 7 days

#[cfg(feature = "devnet-timing")]
pub const DEFAULT_MIN_INACTIVITY_SECS: i64 = 60; // 1 minute — demo builds only
#[cfg(feature = "devnet-timing")]
pub const DEFAULT_MIN_CHALLENGE_SECS: i64 = 30; // 30 seconds — demo builds only
