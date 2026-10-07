# AfterKey

A crypto inheritance plan on Solana. An owner deposits assets into a program-controlled vault, names beneficiaries and shares, and chooses an inactivity period. A beneficiary can initiate a claim after inactivity; a separate response window gives the owner time to veto. If the owner does not respond before release, the stored beneficiaries can receive their shares without key handover.

[Live devnet prototype](https://after-key-web.vercel.app) · [Architecture](docs/architecture.md) · [Readiness and submission plan](docs/hackathon-readiness.md)

**Status:** unaudited, upgradeable devnet prototype. The web interface supports SOL. SPL-token instructions exist in the program; token management and email notifications are not available in the web interface yet. Use test assets only. Local source changes are not automatically reflected in the public deployment.

Current devnet program: [`DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7`](https://explorer.solana.com/address/DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7?cluster=devnet). The October 6 replacement deployment has verified bytecode parity and live creation, cancellation and recovery receipts in [devnet-deployment.json](docs/devnet-deployment.json). It uses a fresh address after loss of the original upgrade key; old vaults remain under the original program.

[History & recovery](https://after-key-web.vercel.app/history) shows retained Closed records and supports remaining-SOL recovery with the original owner/beneficiary rights. Public lookup is read-only; signing uses the connected wallet. The view covers SOL on the current devnet deployment, with [live recovery evidence](docs/history-recovery-verification.json).

## Run the web app

Requirements: Node.js 22 and npm.

```sh
npm ci
npm run dev --workspace @afterkey/web
```

The app defaults to Solana devnet. Set `NEXT_PUBLIC_RPC_URL` in `apps/web/.env.local` for a dedicated devnet RPC. Never put server secrets in a `NEXT_PUBLIC_` variable. Use a wallet-standard wallet in a browser, set to devnet.

```sh
npm run typecheck
npm run test:unit
npm run build --workspace @afterkey/web
```

## Build and test the program

Install Rust and the Solana/Agave 2.1.0 CLI from their official sources. The SBF build script pins platform tools v1.51 (Rust 1.84.1), compatible with the locked dependency tree. Anchor 0.31.1 is required for IDL regeneration. Builds and tests do not require a funded wallet or send live transactions.

```sh
npm test
npm run test:devnet
```

`npm test` builds the standard timing artifact and runs the full LiteSVM suite. `test:devnet` builds the short-timer artifact and runs lifecycle, token recovery, atomic transaction and timing checks. The normal minimums are 30 days inactivity / 7 days challenge; the `devnet-timing` build minimums are 60 seconds / 30 seconds. Never deploy the short-timer artifact to mainnet.

The tests consume the committed IDL under `packages/program` and execute the compiled `.so` under `target/deploy`. When changing an instruction or account layout, regenerate the IDL/types with Anchor and review the matching client changes before testing/deploying. This reliability update preserves the existing instruction and account layouts.

```sh
npm run build:devnet
npm run check:deploy
```

The deployment check is read-only and uses no wallet secrets. If a local artifact exists, it compares that artifact with public deployed bytecode and fails on mismatch. Building a new artifact does not deploy it. Preserve the original deployment identity and upgrade authority when preparing a devnet upgrade; a fresh build's generated keypair is not the existing program's deployment keypair.

Devnet deployments now use an encrypted key backup and macOS Keychain rather than an unencrypted default wallet file. See [key recovery and deployment](docs/devnet-key-recovery.md) for backup, restore, funding and verified deployment commands. Keep the encrypted backup off this machine and its password separately.

## Closure and recovery

The new source completes a vault by setting its state to `Closed` and retaining its authority record. Account rent stays locked. Deallocating this record cannot safely establish that every possible SPL mint has been drained; retaining it preserves recovery for vault-associated token accounts, including subsequent unsolicited transfers.

- Owner cancellation clears the claim marker. Only the owner can recover remaining assets; beneficiaries cannot initiate an inheritance against a cancelled vault.
- Inheritance completion retains the claim marker. Remaining assets stay distributable to the stored beneficiaries, including after logical closure; the owner cannot withdraw them or reset the claim.
- Closed records are hidden from the active web lists. Recovery of remaining SPL balances currently uses program instructions rather than token UI.

This protects records closed by the updated program. It cannot restore a record already deallocated by an older deployment. Contract upgrades and source parity must be verified before representing these behaviors as deployed.

## Architecture and product scope

- `programs/proof-of-life`: Anchor program; custody, authority checks and the state machine.
- `apps/web`: Next.js application; wallet signatures and direct chain reads.
- `packages/program`: committed IDL and client types.
- `tests`: LiteSVM lifecycle/adversarial tests and exact amount/share validation.
- `scripts`: deployment configuration, read-only verification and live demo.
- `docs`: architecture, product, security and business plans.

The planned notification/indexer backend remains a convenience layer outside the custody/authorization path. Chain actions must remain usable if that backend is unavailable.

## Competition history

The original prototype was committed in July 2026. Crypto World's Fair progress must disclose this baseline and distinguish new work completed during the September–October competition. See the readiness document for the milestone gates and manual two-wallet checklist. Report actual tester feedback and transaction evidence; do not treat design documents as completed features.
