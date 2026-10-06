# Devnet deployment keys and recovery

The original devnet upgrade authority was lost during a PC wipe. Creating a new wallet cannot authorize an upgrade to that program. A fresh deployment uses a new program ID; its vaults and configuration are separate. Do not represent this as a migration of old vaults.

The original program is `6njwUjht6L2si9uEoPJHgYwXskMCx7P1Po5DuSYbFPvP`, with authority `EmEtrbDg915iuqPyweXJ18R5aA4XdH9ERqVi9HDqT9za`. A read-only inventory on October 6, 2026 found one released vault, zero SOL escrow balance and no classic SPL token accounts owned by that vault. Future deposits to the old addresses would still belong to the old program.

## Encrypted backup

`scripts/devnet-keystore.ts create` generates separate authority, program and upload-buffer keys. The private keys are encrypted with AES-256-GCM; its authenticated header includes the public addresses, cluster, salt and nonce. The password derives the encryption key through scrypt (`N=131072`, `r=8`, `p=1`, 32-byte key). Format version 1 fixes these algorithms and parameters. Wrong passwords, changed ciphertext and changed public metadata fail authentication.

The encrypted backup is saved outside the repository under `~/Library/Application Support/AfterKey/devnet-keys/`, with restrictive file permissions. Its unlock password is stored in macOS Keychain. The password is entered in a hidden native dialog and is never passed through command arguments or printed in logs.

**Copy the encrypted backup to independent storage and keep the password separately.** A backup left on the same PC does not survive another wipe. Losing both the password/Keychain and the recovery password makes the encrypted keys unrecoverable. Losing the encrypted file also loses the keys, even when the password survives.

Restore on another Mac with Node, repo dependencies and Swift installed:

```sh
node --import tsx scripts/devnet-keystore.ts restore "/path/to/program.enc.json"
```

The password is requested locally and the backup is authenticated before saving it in that Mac's Keychain. No private-key export is printed. The deployment helper can also prompt for the recovery password directly if the Keychain item is unavailable.

## Deploy and upgrade

Use the official Solana CLI on `PATH`, or set `SOLANA_CLI` to its binary path. These commands explicitly use the public Solana devnet endpoint; they do not target mainnet.

```sh
npm run build:devnet
npm run deploy:devnet -- fund "/path/to/program.enc.json" 5
npm run deploy:devnet -- deploy "/path/to/program.enc.json"
npm run check:deploy
```

The faucet may reject or rate-limit requests. Fund the public authority with **test SOL** through the official faucet or an existing devnet wallet; private keys are not needed to receive funds. The deploy command checks the public IDL address, signing authority and balance first. The binary must have been built and verified for the intended program ID and devnet timing before calling deploy.

During signing, the helper unlocks keys into temporary files readable only by the current user. It removes those files after completion and handled termination. The encrypted upload-buffer key remains available if a deployment fails and needs resuming. A forced kill or machine crash can interrupt cleanup; do not treat temporary signing files as backups.

After deployment, the helper immediately initializes the configuration when absent, verifies the expected admin and 60-second/30-second devnet minimums, checks the upgrade authority, and compares the deployed bytecode with the local binary. It saves a public receipt to `docs/devnet-deployment.json`. Publish the frontend address change only after those checks succeed. For later upgrades, use the same encrypted keys and program ID.
