# AfterKey submission pack — October 12, 2026

## Submission deadline and founder tasks

The [official rules](https://colosseum.com/legal/Crypto%20World's%20Fair%20Hackathon%20Rules.pdf), section 5, end the contest on October 12 at 11:59 p.m. Pacific: **October 13 at 7:59 a.m. Lagos time**. Submit tonight and retain the portal receipt. The current project form requests a separate pitch video of up to 2 minutes and a live-product demo of up to 3 minutes, plus team/location details, a graphic, repository and market/distribution information.

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

## Pitch video script — approximately 1 minute 40 seconds

Hi, I’m [name], based in [country], and I’m building AfterKey: a Solana inheritance plan that does not require sharing your seed phrase.

If a crypto owner cannot return to their wallet, their family may have no safe path to the assets. Sharing a seed phrase in advance gives away control immediately. I wanted an alternative with clear rules for both sides.

An owner names beneficiary wallets and shares, sets an inactivity period and a separate response window, then funds a vault. Check-ins keep the plan active. After inactivity, a beneficiary can start a claim. The owner can veto it before release. If nobody responds, the Solana program pays the saved beneficiaries. A company signature is not required.

During this hackathon, we extended an earlier prototype into a working devnet flow: atomic creation and funding, clearer wallet approvals and receipts, claims and vetoes, SOL payout, retained History, and recovery for SOL arriving after closure. The app and source are public.

This is an unaudited, upgradeable devnet prototype. The web app supports SOL, measures inactivity rather than death, and asks owners to set their own reminders. We are now focused on watching owners and beneficiaries use it without coaching and learning where the handoff needs to improve.

AfterKey gives families a plan they can inspect and act on, while the owner keeps their keys.

Replace the name, country and first-person contribution with accurate team details. Record this separately from the product demo. Keep the final pitch under 2 minutes.

## Demo recording checklist — maximum 3 minutes

1. Show the devnet label and explain that only vault assets are covered.
2. Owner creates a small SOL plan with the 2-minute/1-minute demo presets. Show review, one wallet approval and the receipt.
3. Show a check-in. Cut the actual waiting period with a visible “time condensed” caption; do not imply that timing checks were bypassed.
4. Beneficiary starts a claim; owner vetoes it. Show the reset state.
5. After another actual wait and claim, complete/receive the inheritance using the current atomic flow. Show the Explorer payout.
6. Show the retained History record and original recovery rights.
7. End with the app and repository URLs. Retain signatures separately for evidence.

No contract upgrade is required for this demo. Freeze core program changes today unless a verified defect blocks it.
