# Vision — Proof of Life

## The problem

Crypto's core strength — self-custody — is also its most brutal failure mode. When a key holder dies, becomes incapacitated, or simply loses access, the assets are gone forever. Estimates consistently put permanently lost Bitcoin alone at 2.3–3.7M BTC (Chainalysis and others); across all chains, tens of billions of dollars are already unreachable, and the number grows every year as early adopters age.

Traditional inheritance doesn't work for crypto:

- **Wills don't transfer keys.** A court order cannot move a UTXO or sign a Solana transaction.
- **Sharing seed phrases is a security hole.** Anyone told the phrase can drain the wallet today, not after death.
- **Custodians defeat the point.** Handing assets to an exchange for inheritance re-introduces the counterparty risk self-custody was meant to eliminate.
- **Multisig with family is fragile.** It requires technically sophisticated heirs and continuous coordination.

## The insight

Death does not need to be *proven* on-chain. **Absence can be measured.** A dead-man's switch — "if I don't check in for N months, and I don't respond to a final challenge window, release my assets to people I chose" — captures the real-world semantics of inheritance without oracles, courts, or trusted third parties. The owner's ordinary on-chain liveness *is* the proof of life.

## The product

Proof of Life is a Solana protocol where a user:

1. Creates an inheritance vault (a PDA only they control).
2. Deposits SOL/SPL tokens.
3. Names beneficiaries with percentage shares.
4. Picks an inactivity threshold (6 months, 1 year, 2 years).
5. Lives their life — a one-click "check-in" (or any owner-signed vault interaction) resets the timer.
6. If they go silent past the threshold, a beneficiary can start a claim. A challenge window opens (default 30 days) with aggressive multi-channel notification. One signature from the owner cancels everything. Silence through the window releases assets per the configured shares.

The owner never gives up control. Beneficiaries never learn keys. No one — including us — can touch the assets early.

## Who it's for

| Segment | Why they care | How they find us |
|---|---|---|
| Long-term Solana holders ("hodlers") | Real fear of family losing access; already self-custody | Wallet integrations, crypto Twitter/X, Solana communities |
| Crypto-native parents / spouses | Concrete beneficiary in mind | Content marketing ("what happens to your crypto when you die") |
| DAOs / small teams (later) | Key-person risk on treasuries | Direct outreach, Squads ecosystem |
| Wallets & protocols (B2B2C, later) | Inheritance as a feature they can't build themselves | SDK / CPI integration |

## Why Solana

- **Fees make liveness cheap.** A check-in costs a fraction of a cent — a dead-man's switch on Ethereum L1 costs real money per heartbeat, which distorts user behavior.
- **The ecosystem funds consumer security infra.** Solana Foundation grants, Superteam, and Colosseum hackathons actively look for products like this.
- **No serious incumbent.** Inheritance products exist on EVM (Safe modules, Sarcophagus-style) but Solana's slot is open.
- **Composability.** Vaults as PDAs let wallets and protocols integrate inheritance via CPI later.

## What winning looks like

- **Year 1:** The default answer to "how do I set up crypto inheritance on Solana." 10k+ vaults, meaningful TVL, an audit, and at least one wallet integration conversation.
- **Year 2–3:** Inheritance infrastructure — an SDK other protocols embed; Token-2022, NFTs, multi-chain via the same product surface; optional attestation layers (multisig guardians, legal-document anchoring) for high-value estates.

## Principles (non-negotiable)

1. **Non-custodial forever.** If a design requires us to hold keys or assets, it's wrong.
2. **The chain is the product.** The protocol must work with a wallet and an explorer even if our servers and website disappear.
3. **False release is the cardinal sin.** Every timing default, notification channel, and challenge mechanism is tuned to make "assets released while owner alive" effectively impossible. A late inheritance is annoying; an early one is catastrophic.
4. **Boring cryptography.** No novel primitives in v1. Ed25519 signatures and clock comparisons only. Secret-sharing, ZK, and social recovery are research tracks, not MVP dependencies.

## Monetization (deferred, options ranked)

Not an MVP concern; adoption and trust come first. Ranked options for later:

1. **Claim fee** (e.g. 50 bps on released assets) — aligns revenue with delivered value, charged to beneficiaries at the moment of maximum gratitude.
2. **Premium notifications/attestations** — subscription for SMS/phone-call escalation, guardian co-signers, legal-document vaulting.
3. **B2B licensing** — wallets pay to embed the SDK white-label.

We explicitly reject: custody fees, token launches as a business model, and selling user data.

## Naming note

**AfterKey** is the name — repo, product, and brand. (An earlier placeholder name, "Proof of Life," was used in the first draft of these docs and has been fully retired.) Still subject to trademark screening before a public launch.
