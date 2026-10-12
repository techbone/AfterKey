# AfterKey demo video — submission version

Target edited length: **2:50**, with a hard limit of 3:00. Record the real lifecycle first, then cut waiting periods and wallet-loading pauses. Use the live app: https://after-key-web.vercel.app.

## Before recording

- Use separate owner and beneficiary wallets, both on Solana devnet with test SOL for fees. Keep their seed phrases and recovery screens out of the recording.
- Copy the beneficiary address before starting. Use one beneficiary at 100%, a 0.1 test SOL deposit, 2-minute inactivity and 1-minute response-window demo presets.
- Open the owner dashboard and beneficiary inheritance page in separate browser profiles or switch the connected wallet deliberately. Confirm the displayed address after each switch.
- Wait for every transaction to confirm. After the first claim, veto promptly, before the 1-minute response window expires.
- The raw recording will take longer than three minutes. Actually wait through the two inactivity periods and final response period. Label every waiting-period cut **“Time condensed — actual devnet wait.”** Do not change the system clock or imply that on-chain timing was bypassed.
- Add captions for the narration. Record the completed sequence before editing so you can use actual receipts and Explorer transactions.

## 0:00–0:15 — Introduce the working app

**Screen:** Show the landing page, click Launch App, and show the devnet label.

**Say:** “This is AfterKey: a crypto inheritance plan on Solana, without sharing your keys. I’ll show the complete owner-to-beneficiary flow using test SOL on devnet.”

## 0:15–0:50 — Create and fund

**Screen:** Connect the owner wallet → + New vault. Enter the beneficiary address at 100%. Continue to Timing: choose the 2-minute inactivity and 1-minute response-window demo presets. Continue to Review & fund: enter 0.1 SOL, show the summary, click Create & fund vault, approve and show the confirmed receipt.

**Say:** “As the owner, I choose who inherits, their share, and two waiting periods. Here, one beneficiary receives one hundred percent. I’m using short demo timers and depositing point one test SOL. The review screen makes those rules explicit. One wallet approval creates and funds the vault together.”

## 0:50–1:05 — Prove owner control

**Screen:** Open Your vaults, click I'm alive, approve, then show the reset countdown.

**Say:** “The owner remains in control before release. This check-in resets the inactivity timer. A beneficiary cannot claim while that timer is still running.”

## 1:05–1:30 — Start a beneficiary claim

**Screen:** Cut the real 2-minute wait with the time-condensed caption. Connect the beneficiary wallet, open Your inheritances, show the eligible vault and click Start a claim. Approve and show the response countdown.

**Say:** “After the owner’s inactivity period passes, the named beneficiary can start a claim. That does not immediately release the funds. It opens a separate response window for the owner.”

## 1:30–1:50 — Show the owner veto

**Screen:** Return to the owner wallet and Your vaults. Show A claim is in progress. Click I'm alive — cancel this claim, approve promptly, and show the active state and reset timer.

**Say:** “If the owner returns, they can veto the claim with their wallet. Here, the claim is cancelled and the plan returns to active. No seed phrase is shared with the beneficiary.”

## 1:50–2:20 — Complete inheritance

**Screen:** Cut the next real 2-minute inactivity wait. The beneficiary starts a second claim. Cut the actual 1-minute response wait. Click Receive inheritance, approve once, show the confirmed receipt, then open its devnet Explorer transaction and show the beneficiary transfer.

**Say:** “Now I repeat the claim and let the response window finish without an owner response. Receive inheritance completes the release and SOL payout in one transaction. The program sends the funds to the saved beneficiary; AfterKey does not need to approve completion.”

## 2:20–2:40 — Show retained history

**Screen:** Open History and select Completed. Show this vault’s retained record, beneficiaries and recovery rights. If necessary, look up the owner wallet address. Do not imply that you executed a recovery unless you record a real recovery transaction.

**Say:** “The completed vault stays visible in History. Its record preserves the original payout rights, including recovery of SOL that arrives after closure. The owner cannot take back an inherited payout.”

## 2:40–2:50 — State scope and close

**Screen:** Show the app and repository URLs as an end card.

**Say:** “This is an unaudited, upgradeable devnet prototype. It measures inactivity, not proof of death. Owners set their own reminders. Try AfterKey and inspect the public source.”

**End card:**

AfterKey — crypto inheritance without sharing your keys.

https://after-key-web.vercel.app

https://github.com/techbone/AfterKey

## Final recording check

Keep the export below three minutes. Show actual confirmed transactions and label condensed waits. No notification Settings or inbox scene belongs in this version. Do not claim an audit, mainnet readiness, automatic detection of death, or coverage of assets outside the vault. Save the creation, check-in, claim, veto and payout signatures separately as evidence.
