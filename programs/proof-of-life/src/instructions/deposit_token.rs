use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::CONFIG_SEED;
use crate::errors::PolError;
use crate::events::Deposited;
use crate::state::{Config, Vault, VaultState};

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_token_account: Account<'info, TokenAccount>,
    /// Vault custody is a plain ATA owned by the vault PDA
    /// (smart-contracts.md §4.3); created lazily on first deposit of a mint.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_token_handler(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, PolError::Paused);
    ctx.accounts.vault.assert_state(VaultState::Active)?;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.last_checkin = now;

    emit!(Deposited {
        vault: vault.key(),
        owner: vault.owner,
        mint: ctx.accounts.mint.key(),
        amount,
        timestamp: now,
    });
    Ok(())
}
