use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::SOL_ESCROW_SEED;
use crate::errors::PolError;
use crate::events::{ClaimVetoed, Withdrawn};
use crate::state::{Vault, VaultState};

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [SOL_ESCROW_SEED, vault.key().as_ref()],
        bump = vault.sol_escrow_bump
    )]
    pub sol_escrow: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

// Owner sovereignty: allowed in Active AND InChallenge; withdrawing during a
// challenge is proof of life and auto-vetoes (smart-contracts.md §5 #5).
pub fn withdraw_sol_handler(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault_key = ctx.accounts.vault.key();

    let auto_veto = match ctx.accounts.vault.state {
        VaultState::Active => false,
        VaultState::InChallenge => true,
        _ => return err!(PolError::WrongState),
    };

    require!(
        ctx.accounts.sol_escrow.lamports() >= amount,
        PolError::InsufficientFunds
    );
    // TODO(M2, test matrix): partial withdrawals leaving 0 < balance < rent-
    // exempt minimum on the escrow fail at runtime; UI should snap to "all"
    // near the floor. Covered by a dedicated boundary test.

    let bump = ctx.accounts.vault.sol_escrow_bump;
    let seeds: &[&[u8]] = &[SOL_ESCROW_SEED, vault_key.as_ref(), &[bump]];
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sol_escrow.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    let vault = &mut ctx.accounts.vault;
    if auto_veto {
        vault.clear_claim();
        vault.state = VaultState::Active;
        emit!(ClaimVetoed {
            vault: vault_key,
            owner: vault.owner,
            auto_veto: true,
            timestamp: now,
        });
    }
    vault.last_checkin = now;

    emit!(Withdrawn {
        vault: vault_key,
        owner: vault.owner,
        mint: Pubkey::default(), // SOL sentinel
        amount,
        auto_veto,
        timestamp: now,
    });
    Ok(())
}
