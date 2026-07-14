# Frontend Architecture — AfterKey

## 1. Stack decisions & rationale

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) on Vercel** | One deploy serves the SEO-critical marketing/content site ("what happens to crypto when you die" is a real search-acquisition channel) and the app. Vite+SPA rejected: we'd immediately need a second host for marketing pages and lose SSG/metadata for content. Wallet-heavy routes are client components — App Router doesn't fight that. |
| Language/tooling | TypeScript strict, npm workspaces, Biome (lint+format) | Speed, one config, nothing extra to install |
| Wallet | **`@solana/wallet-adapter`** (Phantom, Solflare, Backpack, Ledger) | Ecosystem standard; Ledger explicitly tested — our target users hold serious money on hardware wallets |
| Chain client | **Anchor TS client generated from IDL** + `@solana/web3.js` | Typed instructions for free; IDL is committed and versioned with the program |
| Server/chain state | **TanStack Query** | The chain is a remote cache problem: poll vault accounts (30s), invalidate on tx confirmation, retry/stale handling built in. All chain reads live behind query hooks. |
| Client state | **Zustand** (one small store) | Only for UI state that outlives a component (wizard progress, selected vault, toasts). Redux rejected: nothing here needs it. |
| UI | **Tailwind + shadcn/ui** | Fast, owned components (copied in, not a dependency), accessible primitives via Radix. The countdown timer + check-in button deserve custom design time; everything else is stock. |
| Forms/validation | react-hook-form + zod | Shares zod schemas with the backend package |
| Auth | **None for the app core; SIWS only for notifications** | Wallet connection IS identity for all chain actions. SIWS (sign a nonce message → backend JWT in httpOnly cookie) exists solely to attach an email to a pubkey. No passwords, no OAuth, no accounts to breach. |

## 2. Route map

```
app/
  (marketing)/
    page.tsx                    # Landing: problem, how it works, security honesty page
    security/page.tsx           # Trust assumptions in plain language (from security.md)
    faq/page.tsx
  (app)/
    dashboard/page.tsx          # Owner home: vault card, countdown, check-in button
    vaults/new/page.tsx         # 3-step wizard: period → beneficiaries → deposit
    vaults/[address]/page.tsx   # Detail: balances, beneficiaries, activity timeline, withdraw
    vaults/[address]/settings/  # Edit beneficiaries/periods, close vault
    claim/page.tsx              # Beneficiary flow: paste/connect → vaults naming me → claim
    claim/[address]/page.tsx    # Claim status: challenge countdown, finalize/receive
    settings/page.tsx           # Email + notification prefs (SIWS-gated)
  api/                          # none — backend is a separate service; no Next API routes
```

## 3. Data-fetching strategy

- **Money-relevant reads → RPC directly** (`useVault(address)` fetches+decodes the account via Anchor client). The user's own funds view must not trust our backend (security.md §2).
- **Convenience reads → backend REST** (`useVaultsByBeneficiary`, activity timeline) — things RPC can't answer cheaply without an index. Each such view shows on-chain verification state where it matters (claim page re-verifies the vault account before enabling buttons).
- **Writes:** build ix with Anchor client → `sendTransaction` via wallet-adapter → optimistic UI only after confirmation (`confirmed` commitment; `finalized` for distribution) → invalidate queries.
- Poll interval 30s on dashboard, 10s during an active challenge (the page a nervous owner stares at).

## 4. Key components & UX rules

- **`<LifeCountdown/>`** — the hero: time until claimable, color-shifts as it decays, one giant **I'm alive** button. This is the product's emotional core; budget real design time here.
- **`<TxSummary/>`** — every signature preceded by one plain sentence: "This resets your timer. Next deadline: Jan 4, 2027." / "This replaces ALL beneficiaries with the 2 listed." Mandatory for `update_config` (attack-tree G1.1.1 mitigation).
- **`<InheritanceLetter/>`** — printable PDF at vault creation: vault address, what beneficiaries must do, claim URL + CLI fallback instructions. Mitigates attack-tree 3.2 (beneficiaries who never learn the vault exists).
- **Wizard confirmation step** quotes the exact plain-language contract (prd.md §7).
- Beneficiary claim flow assumes a grieving non-expert: no jargon, one action per screen, support email visible.
- Empty/error states written with the same care — RPC hiccups must not look like "your money is gone."

## 5. Directory conventions

```
apps/web/src/
  components/{ui,vault,claim,layout}/
  hooks/            # useVault, useCheckIn, useClaim, useCountdown, useSiws
  lib/{anchor,api,solana,format}.ts
  stores/ui.ts      # the single Zustand store
  config/           # cluster, program id, token list per env
packages/shared/    # zod schemas + types shared with apps/api
packages/program/   # IDL + generated client (built from anchor build artifact)
```

## 6. Quality bar

- Playwright e2e against a local validator: create vault → deposit → check in → warp clock → claim → veto → claim → finalize → distribute (the full lifecycle, automated — this is also the hackathon demo script).
- Lighthouse ≥ 90 on marketing pages (they're the acquisition channel).
- Responsive down to mobile web; no native apps in MVP.
- All copy reviewed against one question: "would a scared non-technical spouse understand this screen?"
