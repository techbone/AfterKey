use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{TOTAL_SHARE_BPS, VAULT_SEED};
use crate::errors::PolError;
use crate::events::Distributed;
use crate::state::Vault;

// Permissionless crank, one call per mint. remaining_accounts = beneficiary
// ATAs in stored order — each is validated by DERIVING the ATA from the
// stored beneficiary key + mint, never trusting caller-supplied addresses
// (attack-tree.md G2.3). Beneficiary ATAs must exist; the cranker creates
// them idempotently client-side first (smart-contracts.md §5).
#[derive(Accounts)]
pub struct DistributeToken<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn distribute_token_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, DistributeToken<'info>>,
) -> Result<()> {
    let vault = &ctx.accounts.vault;
    require!(vault.inheritance_released(), PolError::WrongState);

    let recipients = ctx.remaining_accounts;
    require!(
        recipients.len() == vault.beneficiaries.len(),
        PolError::NotBeneficiary
    );

    let total = ctx.accounts.vault_token_account.amount;
    let mint_key = ctx.accounts.mint.key();
    let vault_key = vault.key();
    let owner_key = vault.owner;
    let vault_id_bytes = vault.vault_id.to_le_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, owner_key.as_ref(), &vault_id_bytes, &[vault.bump]];

    let mut paid: u64 = 0;
    let last = vault.beneficiaries.len() - 1;
    for (i, b) in vault.beneficiaries.iter().enumerate() {
        let expected_ata = get_associated_token_address(&b.key, &mint_key);
        require_keys_eq!(recipients[i].key(), expected_ata, PolError::NotBeneficiary);

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
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: recipients[i].clone(),
                        authority: vault.to_account_info(),
                    },
                    &[seeds],
                ),
                amount,
                ctx.accounts.mint.decimals,
            )?;
        }
    }

    // Drained: close the vault ATA. Rent goes to the cranker as a small
    // reward for completing the inheritance.
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.cranker.to_account_info(),
            authority: vault.to_account_info(),
        },
        &[seeds],
    ))?;

    let now = Clock::get()?.unix_timestamp;
    emit!(Distributed {
        vault: vault_key,
        owner: owner_key,
        mint: mint_key,
        total,
        timestamp: now,
    });
    Ok(())
}
