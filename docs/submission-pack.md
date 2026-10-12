# AfterKey submission pack — October 12, 2026

## Submission deadline and founder tasks

The [official rules](https://colosseum.com/legal/Crypto%20World's%20Fair%20Hackathon%20Rules.pdf), section 5, end the contest on October 12 at 11:59 p.m. Pacific: **October 13 at 7:59 a.m. Lagos time**. Submit tonight and retain the portal receipt. The [submission FAQ](https://colosseum.com/hackathon) requests a 2–3 minute presentation, a demo no longer than 3 minutes, team/location details, a graphic, repository and market/distribution information.

Founder tasks: confirm registration and project draft; fill in team/location and real customer-discovery evidence; record and upload both videos; check every public link; submit and save the receipt. No receipt or recording has been supplied yet.

## Copy for the project form

**Name:** AfterKey

**Tagline:** Crypto inheritance on Solana, without sharing your keys.

**Short description:** AfterKey lets a Solana owner fund an inheritance vault, name beneficiary wallets and set inactivity and response periods. Regular check-ins keep the plan active. After inactivity, a beneficiary can start a claim; the owner can respond before release. Payout follows the saved shares. The current interface is a devnet SOL prototype with atomic transactions, clear review screens, retained records and recovery for assets arriving after closure.

**Why Solana:** The vault account stores the owner, beneficiaries, shares and timing rules. The program enforces claim eligibility and payout destinations. Completion does not require a company approval; beneficiaries need their own wallets, never the owner's seed phrase. The program remains upgradeable and unaudited.

**Links:** [App](https://after-key-web.vercel.app), [Source](https://github.com/techbone/AfterKey), [Trust and limits](https://after-key-web.vercel.app/security), [History](https://after-key-web.vercel.app/history), [Program](https://explorer.solana.com/address/DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7?cluster=devnet), [PNG graphic](https://after-key-web.vercel.app/afterkey-mark.png), [SVG source](https://after-key-web.vercel.app/afterkey-mark.svg).

**Build-period disclosure:** The repository has a July 2026 baseline. Work during the hackathon added atomic create/fund, cancel/recovery and inheritance completion, transaction/input reliability, owner/heir UX, a fresh verified devnet deployment after loss of the original authority, closed-record History and SOL recovery. Notification backend preparation is retained in the repository as deferred work; notification UI and the frontend proxy were removed from the submission. No email delivery is claimed. Earlier vaults were not migrated.

**Initial distribution hypothesis:** Start with Solana holders who want a simple plan for a trusted relative. Recruit small founder-led tests through existing Solana communities, measure whether owners and beneficiaries can complete the lifecycle unaided, and improve the handoff instructions. Potential future partnerships with wallets and estate-planning services are proposals, not existing agreements.

**Demand validation:** Founder self-reported core-flow testing; repository contains signed devnet smoke evidence. No external tester count, paid customers, revenue or signed partnerships are claimed. Add actual interview/tester evidence here before submission if available.

## Presentation script — approximately 2½ minutes

If someone cannot return to their crypto wallet, the people they care about may have no safe way to receive its assets. Giving away a seed phrase solves access by giving away control. AfterKey offers a plan with rules that both sides can understand.

An owner connects a Solana wallet, chooses beneficiary wallets and their shares, sets an inactivity period and a separate response window, then funds a vault. The review screen shows exactly what the wallet will approve. Check-ins reset the inactivity timer.

After inactivity, a named beneficiary can start a claim. The response window gives the owner time to check in or veto it. If nobody responds, the program releases the vault's assets according to the stored shares. Solana enforces those destinations; AfterKey does not need to approve completion.

We focused on the failure cases as well as the happy path. Creation and funding are atomic. Confirmed transactions have persistent receipts. Cancelled and completed plans retain a record, and assets arriving later can still be recovered under the original rights. The History screen makes those rights visible rather than leaving users with a vanished plan.

The prototype is live on Solana devnet and its current web flow supports SOL. It is upgradeable, unaudited, and based on inactivity rather than proof of death. We make those limits explicit. Owners set their own reminders and check vault status; this release does not send email or claim alerts.

Our first audience is Solana holders and the relatives they name. Our next validation step is to watch both sides complete the flow without coaching, measure missed check-ins and confusing handoffs, and use that evidence before expanding distribution or asking users to trust real funds.

AfterKey is a practical inheritance plan: clear rules, visible deadlines, and no seed phrase passed from one person to another. Try the devnet demo and inspect the public source.

Insert a short factual founder introduction and real discovery evidence; do not invent traction. Check the final recorded duration.

## Demo recording checklist — maximum 3 minutes

1. Show the devnet label and explain that only vault assets are covered.
2. Owner creates a small SOL plan with the 2-minute/1-minute demo presets. Show review, one wallet approval and the receipt.
3. Show a check-in. Cut the actual waiting period with a visible “time condensed” caption; do not imply that timing checks were bypassed.
4. Beneficiary starts a claim; owner vetoes it. Show the reset state.
5. After another actual wait and claim, complete/receive the inheritance using the current atomic flow. Show the Explorer payout.
6. Show the retained History record and original recovery rights.
7. End with the app and repository URLs. Retain signatures separately for evidence.

No contract upgrade is required for this demo. Freeze core program changes today unless a verified defect blocks it.
