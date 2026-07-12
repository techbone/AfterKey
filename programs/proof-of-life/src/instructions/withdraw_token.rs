use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::VAULT_SEED;
use crate::errors::PolError;
use crate::events::{ClaimVetoed, Withdrawn};
use crate::state::{Vault, VaultState};

#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ PolError::NotOwner)]
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Owner sovereignty: allowed in Active AND InChallenge (auto-veto), mirroring
// withdraw_sol. Emptying the balance closes the vault ATA (rent → owner) so
// close_vault can't strand orphaned token accounts.
pub fn withdraw_token_handler(ctx: Context<WithdrawToken>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let auto_veto = match ctx.accounts.vault.state {
        VaultState::Active => false,
        VaultState::InChallenge => true,
        _ => return err!(PolError::WrongState),
    };

    let balance = ctx.accounts.vault_token_account.amount;
    require!(balance >= amount, PolError::InsufficientFunds);

    let vault_key = ctx.accounts.vault.key();
    let owner_key = ctx.accounts.vault.owner;
    let vault_id_bytes = ctx.accounts.vault.vault_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner_key.as_ref(),
        &vault_id_bytes,
        &[ctx.accounts.vault.bump],
    ];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    if amount == balance {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault_token_account.to_account_info(),
                destination: ctx.accounts.owner.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ))?;
    }

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
        mint: ctx.accounts.mint.key(),
        amount,
        auto_veto,
        timestamp: now,
    });
    Ok(())
}
