use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::{CONFIG_SEED, SOL_ESCROW_SEED};
use crate::errors::PolError;
use crate::events::Deposited;
use crate::state::{Config, Vault, VaultState};

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
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

pub fn deposit_sol_handler(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, PolError::Paused);
    ctx.accounts.vault.assert_state(VaultState::Active)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.sol_escrow.to_account_info(),
            },
        ),
        amount,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.last_checkin = now;

    emit!(Deposited {
        vault: vault.key(),
        owner: vault.owner,
        mint: Pubkey::default(), // SOL sentinel
        amount,
        timestamp: now,
    });
    Ok(())
}
