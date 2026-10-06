use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::{SOL_ESCROW_SEED, TOTAL_SHARE_BPS};
use crate::errors::PolError;
use crate::events::Distributed;
use crate::state::Vault;

// Permissionless crank. remaining_accounts = beneficiary wallets in the exact
// order stored on the vault — each key is validated against stored state, so
// a malicious cranker cannot redirect a single lamport (attack-tree.md G2.3).
#[derive(Accounts)]
pub struct DistributeSol<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn distribute_sol_handler<'info>(ctx: Context<'_, '_, 'info, 'info, DistributeSol<'info>>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    require!(vault.inheritance_released(), PolError::WrongState);

    let recipients = ctx.remaining_accounts;
    require!(
        recipients.len() == vault.beneficiaries.len(),
        PolError::NotBeneficiary
    );

    let total = ctx.accounts.sol_escrow.lamports();
    if total == 0 {
        return Ok(()); // idempotent: nothing to distribute
    }

    let vault_key = vault.key();
    let bump = vault.sol_escrow_bump;
    let seeds: &[&[u8]] = &[SOL_ESCROW_SEED, vault_key.as_ref(), &[bump]];

    let mut paid: u64 = 0;
    let last = vault.beneficiaries.len() - 1;
    for (i, b) in vault.beneficiaries.iter().enumerate() {
        require_keys_eq!(recipients[i].key(), b.key, PolError::NotBeneficiary);

        // floor(total × share / 10000); rounding dust goes to the last
        // beneficiary so Σ payouts == total exactly (proptest invariant).
        let amount = if i == last {
            total.checked_sub(paid).ok_or(PolError::MathOverflow)?
        } else {
            ((total as u128)
                .checked_mul(b.share_bps as u128)
                .ok_or(PolError::MathOverflow)?
                / TOTAL_SHARE_BPS as u128) as u64
        };
        paid = paid.checked_add(amount).ok_or(PolError::MathOverflow)?;

        if amount > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.sol_escrow.to_account_info(),
                        to: recipients[i].clone(),
                    },
                    &[seeds],
                ),
                amount,
            )?;
        }
    }

    let now = Clock::get()?.unix_timestamp;
    emit!(Distributed {
        vault: vault_key,
        owner: vault.owner,
        mint: Pubkey::default(), // SOL sentinel
        total,
        timestamp: now,
    });
    Ok(())
}
