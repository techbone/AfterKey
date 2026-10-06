# AfterKey hackathon readiness — October 6, 2026

Assessment baseline: `5f7a0f1` (July 14, 2026). This report records inspected source, commands actually run, and public deployment reads. The current rollout below verifies program bytecode and signed program smoke transactions; the new browser flow still needs a fresh two-wallet walkthrough. Earlier assessments are retained as historical evidence.

## Current rollout — fresh devnet program verified

The founder confirmed the original upgrade-authority key was lost during a PC wipe and no recovery backup remains. A fresh program was deployed at [`DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7`](https://explorer.solana.com/address/DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7?cluster=devnet). This is a replacement deployment, not an upgrade or migration of the original program's vaults. The old program was inventoried read-only: one released vault, zero SOL escrow and no classic SPL token accounts owned by that vault.

The new authority and config admin are `Bs7Uok84x4tiWy3hjohmRFcTjVJxtvXzE39WBQp54qSM`. Deployment keys have an authenticated encrypted backup outside the repository; its password is saved in macOS Keychain. Independent off-machine backup remains a founder responsibility, as described in [devnet-key-recovery.md](devnet-key-recovery.md).

At slot `508071667`, deployed bytecode matched the tested 405,320-byte devnet artifact (SHA256 `1fb7171ac9db3b45f54184a8098b377afbaf779109978097a8421a977f19dd09`). The config is unpaused with minimum inactivity **60 seconds** and challenge **30 seconds**. A signed live check atomically created/funded a vault with 0.01 test SOL, cancelled it while retaining its Closed record, and successfully recovered a subsequent SOL transfer after closure. Transaction evidence is in [devnet-deployment.json](devnet-deployment.json).

Verification: **77 standard tests passed**, **19 devnet lifecycle/recovery/timing tests passed**, both TypeScript projects passed, and the production web build passed. Upload instructions were exercised against loader-v3 in LiteSVM, including wrong-authority rejection. The frontend/IDL now reference the replacement address. Next gate: a fresh owner/beneficiary browser walkthrough on the published app, followed by reminders and submission materials. A remote CI run is not yet evidenced by this report.

## Earlier milestone — local reliability candidate

The founder reports completing the baseline devnet walkthrough. That is manual evidence for the previous deployment, not a retest of this new candidate.

The first improvement milestone, subsequently pushed directly to `main`, adds atomic SOL creation/cancellation/finalization/payout, exact amount/share validation, rent-floor checks, query errors/retry, durable wallet-scoped receipts, and a three-step review-before-signing flow with copyable beneficiary instructions. Owner/inheritance navigation and a trust page now show the actual devnet scope; unsupported notification promises were removed. Closed vaults retain their record and rent to preserve recovery rights, as specified in [closure-recovery.md](closure-recovery.md).

Verification for the candidate: Rust native compile check passed; standard SBF build executed **75 passing tests**; short-timer SBF build executed **19 passing lifecycle/recovery/timing tests**. Both TypeScript projects and the production web build passed. The disconnected browser routes were inspected at a 375px viewport without horizontal overflow or console errors. The newly signed browser flow still needs a wallet retest after deployment. A CI workflow is included; its remote run has not been observed.

The read-only deployed-bytecode comparison detects that the public program differs from the candidate. The public program and website have not been upgraded by this milestone. Next gate: review the retention/rent tradeoff, upgrade the reviewed devnet artifact with the existing deployment identity, deploy the corresponding frontend, verify bytecode parity and record a fresh two-wallet walkthrough. Then proceed to reminders and submission materials. The original assessment below is retained as the baseline record.

## Submission timing and development history

The competition in the supplied registration screenshot is **Crypto World's Fair**, with a dedicated Solana track. The screenshot shows registration in progress; it does not prove registration was completed. Registration and product submission are separate steps.

The [official rules, sections 5–6](https://colosseum.com/legal/Crypto%20World's%20Fair%20Hackathon%20Rules.pdf) set the deadline at **October 12, 2026, 11:59 p.m. Pacific**, which converts to **October 13, 2026, 7:59 a.m. in Lagos**. Recheck the portal before submission. Our internal target should be October 9–10, leaving time to resolve upload problems.

All 12 commits in the July assessment baseline predate the September 14 competition start. New October work is recorded separately above and in subsequent commits on `main`. The [official FAQ](https://colosseum.com/hackathon) allows pre-existing code, requires disclosure of past work, and says judging focuses on work completed during the competition. Treat the July product as the baseline, then document real improvements, dates, and tester feedback. Do not rewrite history to suggest the baseline was built during this event. Work elsewhere remains unverified.

The FAQ requests a **2–3 minute presentation video** and a **product demo video no longer than 3 minutes**, plus team information, a logo/graphic, repository, integrations, go-to-market strategy and demand validation. The existing demo script helps with the demo video; it is not evidence that either video has been recorded. Every teammate must register and be included in the submission.

## Where implementation stopped

The last shipped changes were the beneficiary claim page, released-vault closure, owner cancellation, demo video script, and product rebrand. The existing architecture remains appropriate: Anchor owns custody and timing; Next.js signs transactions and reads chain state; a separate optional backend provides notifications/indexing without controlling funds.

| Existing roadmap milestone | Evidence in repo | Current assessment |
| --- | --- | --- |
| M1: technical validation | Architecture/security documents; LiteSVM harness | Partial. Helius and Squads spike evidence absent. |
| M2: contract MVP | 16 IDL instructions; SOL/SPL custody, claims, veto, distribution; three test files; public devnet program | Substantial implementation. Fresh contract verification and safe token closure remain open. |
| M3: frontend MVP | Landing, `/app`, `/app/new`, `/claim`; wallet standard adapters; countdown and SOL actions | Partial. Production build passes. Token UX, editing, letter, notifications settings and browser lifecycle tests absent. |
| M4: backend | Design documents only; no `apps/api` implementation | Not implemented in this checkout. |
| M5–M7: hardening, beta, launch | Threat model and plans | Completion not evidenced. No audit/tester/launch claims should be made from these documents. |

## Verification performed today

| Check | Result | What it establishes |
| --- | --- | --- |
| Locked dependency install (`npm ci`) | Passed | Repo can install on Node 22; a transitive dependency warns it requires Node 24. |
| Web TypeScript (`tsc --noEmit --incremental false -p apps/web/tsconfig.json`) | Passed | Current frontend passes static type checking. |
| Production web build (`npm run build --workspace @afterkey/web`) | Passed, Next.js 15.5.20 | All four application routes compile/prerender. |
| Root TypeScript (`tsc --noEmit -p tsconfig.json`) | Failed | ESM configuration, untyped Anchor accounts, `.ts` imports and LiteSVM API/type incompatibilities need repair. |
| `npm test` | Blocked at `pretest`: `anchor: command not found` | Contract tests were not rerun. Rust/Anchor/Solana CLIs and `target` artifacts are absent here. |
| Public website | Landing, disconnected owner/beneficiary screens and wallet modal load | Basic deployment smoke test. No installed wallet in the inspection browser; signed flows remain unverified. |
| Public devnet RPC | Program executable; config decoded | Program exists, unpaused, minimum inactivity 60s/challenge 30s. |

Public app: [after-key-web.vercel.app](https://after-key-web.vercel.app).

Program: [`6njwUjht6L2si9uEoPJHgYwXskMCx7P1Po5DuSYbFPvP`](https://explorer.solana.com/address/6njwUjht6L2si9uEoPJHgYwXskMCx7P1Po5DuSYbFPvP?cluster=devnet).

Config PDA: `rmo27Wo47X2bebMZj8Wkmox2J7KuxmSThM3qyx3VzXX`.

ProgramData: `CjRCvim3sYnQt4cLf4pSBpuncCw1zPvX7BA25aBHgFwq`; deployment slot `475774192`. Upgrade authority remains present, address `EmEtrbDg915iuqPyweXJ18R5aA4XdH9ERqVi9HDqT9za` (also config admin). Squads governance and source/binary parity were not verified. A local IDL instruction list cannot prove deployed instruction support.

## Fixes ordered by submission impact

1. **Prevent token stranding during closure.** Both `close_vault` and `close_released_vault` check only the SOL escrow. A vault can still own SPL tokens when its state account is destroyed, removing the account required for withdrawal/distribution. This affects permissionless released closure too. Enforce safety on-chain; client-side enumeration and caller-supplied remaining accounts alone cannot establish that no omitted mint exists. Choose explicit asset tracking or another closure design that preserves recovery, then test omitted accounts and multiple mints. Keeping the demo SOL-only does not fix the program's token custody risk.
2. **Restore reproducible contract checks.** Install the documented toolchain, align the LiteSVM/anchor-litesvm versions and API, repair root TypeScript settings/Anchor types, build the program and rerun the suites. Run both standard and short-timer builds with appropriate timing expectations; verify committed IDL parity. Add regression cases for token closure and the new fixes. Put these checks in CI; no CI workflow is present now.
3. **Recover from partial transactions.** Creation can initialize successfully then fail its deposit, but the wizard reports failure and leaves the created vault undiscovered until refresh. Distribution and closure are also separate transactions. Surface the committed action and signature after each step, refresh on partial failure, and allow continuation without duplicate creation. Re-read escrow balances before actions; avoid deciding from a stale displayed SOL float.
4. **Fix empty-vault cancellation during challenge.** `useCancelVault` skips withdrawal if the balance is zero, then calls `closeVault`, which requires Active. An empty InChallenge vault therefore needs an explicit veto before closure (or a suitable atomic sequence). Test both empty and funded cases.
5. **Make errors, amounts and timing precise.** RPC query failures currently render as empty lists. Show an error with retry. Validate finite nonnegative/positive SOL amounts as appropriate, integer lamports, duplicate addresses and exact basis-point sums before requesting signatures. Buttons use `>=` deadlines while the contract requires strictly `>`; match chain boundaries and explain clock/confirmation delays. Use challenge-specific countdown text instead of telling an heir they can 'start a claim' when a claim is already underway.
6. **Align promises with shipped behavior.** Marketing promises reminders and warnings on every channel; no notification service exists. Wizard promises editing that the UI lacks, and says another wallet can fund the vault even though `deposit_sol` requires its owner. Scope withdrawal guarantees to before release. Clearly label devnet/test assets, retained upgrade authority and current limitations. Update the stale `.env.example` product/program ID. The demo script's early-claim catch accepts every failure, including its own 'BUG' exception; assert the exact expected error and complete the closure step.

## Milestones for this competition

Dates are targets, not a guarantee. Advance on evidence at each gate. Preserve `docs/architecture.md` and the long-term roadmap; this is the submission sprint layered on top.

| Gate | Target (Lagos) | Deliverable | Exit evidence |
| --- | --- | --- | --- |
| A: verified baseline | October 6 | Registration status confirmed; July baseline disclosed; toolchain/test harness repaired; current deployment documented | Build + relevant contract suites passing; deployment smoke checks; actual signatures from a two-wallet run. |
| B: reliable core journey | October 6–7 | Safe closure, cancellation edge case, input validation, error/retry states and partial-transaction recovery | Regression checks pass; create/check-in/veto/payout/cancel complete on deployed devnet; balances verified in lamports. |
| C: distinctive product experience | October 7–8 | Coherent owner/beneficiary navigation; review-before-signing wizard; transaction receipts; understandable inheritance timeline; beneficiary handoff letter/link; responsive/accessibility pass | At least three people complete the owner/heir flow without coaching; record friction and fix it. |
| D: usable notification slice | October 8–9 | Optional verified email + signed wallet association, check-in reminder and claim alert; isolated backend with retry/idempotency and chain reconciliation | Reminder delivered; claim alert delivered within five minutes; chain actions still work with backend stopped. If this gate slips, remove notification promises and disclose omission. |
| E: submission | October 9–10 | Presentation + demo videos, logo, setup README, architecture/trust explanation, tester evidence, current links, July/in-window work disclosure | Clean-browser walkthrough, links checked, portal receipt saved. |

If a reliable SOL demo passes gates A/B earlier, a submission on October 7 may be possible, but premium polish and the notification slice are not yet evidenced. Do not promise a finished product today. Avoid adding chains, NFTs, Token-2022, mainnet deployment or speculative new features to this sprint.

Token support remains part of the original MVP. Fix closure regardless of demo scope; finish token UX only after the core gates pass, or explicitly describe the hackathon frontend as SOL-only and SPL support as program-level work in progress.

## Your two-wallet devnet test checklist

Use a browser with Phantom/Solflare/Backpack installed. Set the wallet to devnet. Prepare separate **Owner A** and **Heir B**, both funded with test SOL for fees; optionally **Heir C** for split checks. Use 2-minute inactivity and 1-minute challenge presets. Never use real assets for this demo. Record vault addresses and transaction signatures. These checks are pending, not already passed.

| Step | Where / action | Pass condition |
| --- | --- | --- |
| 1 | Owner A: `/app` → new vault; choose B at 100%; deposit 0.1 test SOL | Vault appears Active; escrow receives exactly 100,000,000 lamports; creation and deposit receipts exist. |
| 2 | Owner dashboard: check in after several seconds | On-chain last-check-in advances and countdown resets. |
| 3 | Add 0.02 SOL, withdraw 0.01 SOL | Escrow becomes 0.11 SOL; timer resets on both successful actions. Distinguish wallet fees/rent from escrow changes. |
| 4 | Heir B: `/claim` before inactivity elapses | Correct vault/share appears; early claim unavailable/rejected. A different unrelated wallet sees no inheritance. |
| 5 | Wait past the last owner activity + inactivity timer; B starts claim | Vault becomes InChallenge; assets remain in escrow; owner sees the challenge and its actual end time. |
| 6 | Owner A vetoes | One successful veto transaction restores Active, clears the claim, resets timer; B cannot finalize the old claim. |
| 7 | Wait again; B reclaims; wait strictly past challenge end | Finalize succeeds; state becomes Released; no payout before distribution. |
| 8 | B receives inheritance and closes | Escrow is drained; B receives the allocation; separate fee/rent effects accounted for; account closes and disappears after refresh. |
| 9 | New funded vault: owner cancels | Escrow funds return to A and account rent is refunded; vault no longer appears for B. |
| 10 | New zero-deposit vault: initiate challenge, then owner cancels | Must succeed after the cancellation fix; currently expected to expose the missing veto step. |
| 11 | New vault with B/C at 60/40 | Distribution equals exact integer-lamport shares, with rounding remainder to the last beneficiary; total payout equals escrow balance. |
| 12 | Reject initial create signature; then separately reject deposit after creation | First case creates nothing; second case exposes the already-created vault and offers funding/recovery without creating another vault. |
| 13 | Reject closure after payout; reconnect/switch wallets/refresh | Payout is not repeated; completion can resume; connected identity and displayed vaults stay correct. |
| 14 | Invalid/duplicate address, bad share sum, negative/invalid deposit; unavailable RPC | Helpful validation/retry; an RPC failure is never reported as 'no vaults'. |

After a contract fix and new deployment, repeat the affected lifecycle tests and retain evidence. Automated adversarial testing should also cover unauthorized signers, exact deadline boundaries, paused-program exit actions, multiple token mints and attempted closure with tokens remaining.

## How AfterKey should stand out

The existing dark/green style is a usable starting point. Build recognition around **a clear inheritance timeline and a calm explanation of who can do what**, not only color and animations.

- Creation: beneficiaries and percentages first, timing explanation, funding, then a readable final review before signature. Show fee/rent expectations and the exact next check-in deadline.
- Owner home: assets protected, last check-in, next deadline and beneficiaries together; one dominant check-in action and clear receipt after confirmation.
- Heir flow: 'Waiting for owner', 'Claim started', 'Owner can still respond', 'Ready to release', 'Received'. Show the person's expected share alongside the vault total; make distribution and closure outcomes distinct.
- Handoff: printable/shareable instructions with vault address, beneficiary wallet, devnet label, claim link and recovery/runbook instructions. No seed phrase required.
- Wallet experience: installed-wallet detection, guidance when no wallet exists, clear network label, address copying, explorer receipts, rejection/expiry recovery and persistent navigation between owned vaults and inheritances.
- Trust page: explain inactivity rather than verified death, challenge/veto, optional notification availability, on-chain public beneficiaries, token limitations, audit status and upgrade authority.
- Verify narrow/mobile layouts, input labels, keyboard focus and reduced-motion behavior on the actual screens. No responsive or accessibility certification was performed in this assessment.

Judges also evaluate demand and business potential. Gather real feedback from Solana holders and a beneficiary, report actual tester counts, and present the wallet-integration/distribution thesis from the existing business docs. Avoid unsupported loss statistics, invented traction or claims of being audited.
