# AfterKey architecture

AfterKey's submitted prototype runs on Solana devnet. The Vercel-hosted Next.js interface reads chain state through RPC and asks the user's wallet to sign transactions. The Anchor program owns the vault rules and SOL escrow; the web app cannot move assets by itself.

```text
Owner / beneficiary wallet
          │ signed transactions
          ▼
Next.js web app ── RPC reads ── Solana devnet
                                  │
                                  ▼
                         AfterKey Anchor program
                         Vault record + SOL escrow
```

The owner creates and funds a vault, sets beneficiaries and shares, and chooses inactivity and response periods. Owner check-ins reset the inactivity clock. Once it expires, a beneficiary can initiate a claim; the owner can veto during the response period. After that period, anyone can finalize and distribute according to the stored shares. Cancellation and completed inheritance retain a `Closed` vault record so remaining assets can be recovered under the original rights. See [closure and recovery](closure-recovery.md).

The submitted interface handles SOL. The program also contains SPL-token instructions, but token management is not available in the web app. The `/history` route shows closed records and remaining-SOL recovery. It reads the current devnet deployment directly; an older program address remains separate after the original upgrade key was lost.

The program is upgradeable and unaudited. Its upgrade authority is a single key rather than a multisig. Users should use devnet test assets only. No backend, database, email provider or automated reminder service is required by the submitted app. Source in `apps/api` is a deferred notification prototype; delivery is disabled and it is not deployed as part of this product.

The current program address, bytecode comparison and live transaction receipts are recorded in [devnet-deployment.json](devnet-deployment.json). [History/recovery evidence](history-recovery-verification.json) records a live recovery check. The [repository README](../README.md) contains local build and test commands.
