# AfterKey hackathon readiness — October 8, 2026

Assessment baseline: `5f7a0f1` (July 14, 2026). This report records inspected source, commands actually run, and public deployment reads. The founder reported completing the post-deployment browser checklist on October 7; individual browser signatures/screenshots have not been supplied. Earlier assessments are retained as historical evidence.

## October 8 — notification backend prepared; delivery disabled

The founder chose backend preparation before service configuration. `apps/api` now contains wallet-standard sign-in with expiring one-use challenges, opaque HttpOnly sessions, verified optional email preferences, PostgreSQL/Drizzle models and migration, pg-boss jobs, owner reminder/claim-alert scheduling, read-only Solana reconciliation and a Resend transport. Delivery requires an explicit activation flag and durable storage; memory mode cannot send real mail or run in production.

Twelve local API/worker/network-guard tests passed, including replay/expiry/domain binding, CSRF, verification changes, stale-mail suppression, duplicate/retry handling and disabled-provider guards. The local service booted with `storage: memory` and `deliveryConfigured: false`. A read-only live RPC check verified the devnet genesis, executable program and two current vault records. These are preparation tests with fake delivery, not real inbox evidence. Docker became available, but the disposable PostgreSQL image download stalled and was stopped. Two opt-in PostgreSQL/pg-boss integration tests cover concurrent nonce/token consumption, persistence, private-table RLS and queue retry after restart; they are configured in CI but have not yet been observed passing.

Next activation gates are [documented in the backend setup guide](../apps/api/README.md): PostgreSQL configuration/integration, verified email sender, backend hosting, frontend Settings and email-verification flow, real opted-in delivery test and operational monitoring. Notification promises stay absent from the live frontend. The dependency review also prompted patching the existing Next.js 15.5 line and shell-quote; remaining wallet/dependency advisories require assessment before a production/mainnet release.

GitHub Actions could not start because GitHub reports an account billing lock. The founder requested continuing without it while their support report is pending. The workflow is now manual-only; local verification is the release gate. Main commit `9b0da76` deployed successfully on Vercel independently of Actions. Database integration remains an explicit local acceptance gate, not a reason to wait for GitHub billing support.

## October 7 milestone — closed-vault history and SOL recovery

The founder reports completing the October 6 create/check-in/claim/veto/payout/cancellation checklist. This is self-reported manual evidence for the previous frontend release, not independent external-user validation.

The next frontend milestone adds `/history`: retained Closed records involving a wallet, cancellation/completion filters, exact SOL escrow balances, saved beneficiaries, Explorer links and public wallet lookup without signing. A connected owner can recover SOL after cancellation; completed inheritances distribute remaining SOL to all stored beneficiaries. Recovery does not finalize or close a record again, change recipients, reopen a plan, or reclaim record rent. The existing live program supports these instructions; no contract upgrade is required.

Verification: **10 targeted atomic-transaction/recovery/receipt tests passed**, both TypeScript projects passed and the production frontend build passed. Tests cover owner-only cancellation recovery, completed-inheritance payout and rounding, substituted-recipient rollback, rejection of non-Closed/empty recoveries, recovery while paused, and confirmed receipts not waiting for stalled RPC refreshes. The real authority-owned smoke record was given 0.01 devnet SOL, inspected in the read-only browser view, and emptied using the new recovery builder; its record remained Closed. Evidence: [history-recovery-verification.json](history-recovery-verification.json). Desktop and 375px mobile read-only layouts, filters and invalid-address validation were inspected; no horizontal overflow or console errors were observed. Connected-wallet browser approval on this new screen remains a manual acceptance check.

Scope: this is a retained-record browser, not a complete transaction timeline or SPL-token recovery interface. It reads the current devnet program directly; older deployments remain separate. Next: finish the new history/recovery browser acceptance checks, then build the Milestone 4 email reminder/claim-alert backend with signed wallet association and optional verified email. Notification-service downtime must not block on-chain actions.

## Current rollout — fresh devnet program verified

The founder confirmed the original upgrade-authority key was lost during a PC wipe and no recovery backup remains. A fresh program was deployed at [`DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7`](https://explorer.solana.com/address/DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7?cluster=devnet). This is a replacement deployment, not an upgrade or migration of the original program's vaults. The old program was inventoried read-only: one released vault, zero SOL escrow and no classic SPL token accounts owned by that vault.

The new authority and config admin are `Bs7Uok84x4tiWy3hjohmRFcTjVJxtvXzE39WBQp54qSM`. Deployment keys have an authenticated encrypted backup outside the repository; its password is saved in macOS Keychain. Independent off-machine backup remains a founder responsibility, as described in [devnet-key-recovery.md](devnet-key-recovery.md).

At slot `508071667`, deployed bytecode matched the tested 405,320-byte devnet artifact (SHA256 `1fb7171ac9db3b45f54184a8098b377afbaf779109978097a8421a977f19dd09`). The config is unpaused with minimum inactivity **60 seconds** and challenge **30 seconds**. A signed live check atomically created/funded a vault with 0.01 test SOL, cancelled it while retaining its Closed record, and successfully recovered a subsequent SOL transfer after closure. Transaction evidence is in [devnet-deployment.json](devnet-deployment.json).

Verification at deployment: **77 standard tests passed**, **19 devnet lifecycle/recovery/timing tests passed**, both TypeScript projects passed, and the production web build passed. Upload instructions were exercised against loader-v3 in LiteSVM, including wrong-authority rejection. The frontend/IDL now reference the replacement address. The founder subsequently reported completing the browser walkthrough, as recorded above. A remote CI run is not yet evidenced by this report.

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

Use the [published app](https://after-key-web.vercel.app) in a browser with Phantom/Solflare/Backpack installed. Select **Solana devnet**. Prepare separate **Owner A** and **Heir B**, both funded with test SOL for fees; optionally **Heir C** for split checks. Create fresh vaults under program `DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7`: old-program vaults are not migrated. Use the **2-minute inactivity** and **1-minute challenge** presets. Record vault addresses, transaction signatures and screenshots. The founder reports this core checklist is complete; the new history/recovery cases below remain pending browser approval checks. Program-level live smoke and automated evidence are separate.

Create/fund, cancel, and receive/complete are each one atomic transaction in the current SOL interface. A rejected signature leaves that action unapplied. The on-chain Closed record remains after completion or cancellation, while the active lists hide it. Its rent is retained, not refunded. When confirmation is uncertain, refresh and check the transaction in Explorer before repeating an action.

| Step | Where / action | Pass condition |
| --- | --- | --- |
| 1 | Owner A: `/app/new`; name B at 100%; fund with 0.1 test SOL | People → Timing → Review & fund shows correct details. One wallet approval creates and funds the vault. Active escrow receives exactly 100,000,000 lamports; a confirmed receipt and copyable beneficiary instructions remain visible. |
| 2 | Owner dashboard: click `I'm alive` after several seconds | Last check-in advances; inactivity countdown restarts from the latest owner activity. |
| 3 | While Active, deposit 0.02 SOL then withdraw 0.01 SOL | Escrow becomes 0.11 SOL; each successful action resets inactivity. Wallet fees and initial record rent are separate from escrow funds. |
| 4 | Heir B: `/claim` before inactivity elapses; then connect an unrelated wallet | B sees the right owner, vault and share, with early claim unavailable. The unrelated wallet sees no inheritance naming it. |
| 5 | Wait past the last owner activity + 2 minutes; B clicks `Start a claim` | State becomes InChallenge; assets remain in escrow; a separate 1-minute challenge countdown appears. Refresh A's dashboard to see the warning. |
| 6 | A clicks `I'm alive — cancel this claim` | One veto returns Active, clears the claim and resets inactivity. B cannot complete the cancelled claim. |
| 7 | Wait again, B starts another claim, then wait strictly past the challenge countdown | Before expiry, the receive action is unavailable. After expiry, `Receive inheritance` uses one approval to finalize, pay and mark Closed together. Escrow drains; B receives the full allocation before transaction fees. The active card disappears; the receipt remains and the Closed record is visible in Explorer. |
| 8 | New funded Active vault: A clicks `Cancel this vault` and confirms | One approval returns all SOL escrow and marks Closed. The vault disappears from A/B's active lists. Small vault-record rent stays locked; it is not refunded. |
| 9 | New zero-deposit vault: B starts a claim after inactivity; A cancels the entire vault during the challenge | Cancellation succeeds even with zero escrow: veto plus closure occurs in one transaction. It permanently closes the plan and prevents new claims. |
| 10 | New vault with B/C at 60/40 and 0.1 SOL; let inheritance complete | A single receive action pays both wallets: 0.06 SOL to B and 0.04 SOL to C before the sender's fees. General integer-lamport rounding goes to the last beneficiary; allocations sum to the escrow balance. |
| 11 | On separate attempts, reject creation, cancellation and receiving in the wallet | Rejected creation creates no vault or deposit. Rejected cancellation/receiving leaves the previous state and funds intact; refresh to confirm. No partial payout or second approval is required for these actions. |
| 12 | Enter invalid/duplicate addresses, incorrect share totals, negative amounts or more than 9 SOL decimal places; then interrupt RPC access | Invalid inputs show actionable validation before signing. A tiny deposit/withdrawal remainder below the queried rent floor is prevented. RPC failure shows an error/retry, not an empty-vault message. |
| 13 | Refresh, reconnect and switch wallets after successes and rejections; inspect narrow/mobile layout | Correct wallet-specific vaults and receipts appear, without duplicate funding or stale receipts belonging to another wallet. Form, countdown, buttons and Explorer links remain usable. |

For each case, record **Pass / Fail / Not tested**. For failures, include the step, vault address, transaction signature if present, expected outcome, actual outcome and screenshot. Count a confirmed Explorer transaction separately from an unconfirmed wallet approval.

### New history/recovery acceptance checks

1. After cancellation or completion, open **History** with the involved wallet. Verify the correct outcome and saved recipients. Toggle All/Cancelled/Completed and refresh. Counts and records must agree; last-owner activity must not be mistaken for a closure timestamp.
2. Disconnect and look up that public wallet address. Records remain readable, but signing actions require connecting a wallet. Invalid addresses show validation. Connecting changes the view to the connected wallet's records.
3. On a cancelled test vault, use **Inspect SOL escrow** to identify the escrow address, distinct from the vault-record address. Send 0.01 devnet SOL there. The owner reviews and recovers it with one approval; it drains to zero and stays Closed. A named beneficiary sees owner-only rights and cannot recover that cancelled plan.
4. On a completed-inheritance test vault, send 0.01 devnet SOL to its SOL escrow. Review the saved recipient addresses and exact allocations, then distribute once. All saved shares are paid; the owner cannot turn this into a personal withdrawal. The record stays Closed.
5. Decline a recovery signature, reconnect/switch wallets and retry. Declining leaves funds unchanged; confirmed receipts remain visible after the balance becomes zero. Receipts must not appear under another connected wallet. For uncertain confirmation, check Explorer before retrying.

Token balances and token recovery are still program/CLI-level features. Token-2022 and notifications are not browser-test features in this release. Empty SOL escrow does not prove no SPL tokens remain.

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
