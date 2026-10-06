import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PROGRAM_ID, explorerAddr } from "@/lib/solana";

const facts = [
  ["Your wallet controls the plan", "AfterKey never asks for your seed phrase. Your wallet signs creation, deposits, check-ins, withdrawals, and cancellation. Beneficiaries cannot change your plan."],
  ["Inactivity is the condition", "AfterKey does not verify death. A beneficiary may start a claim only after your chosen inactivity period. A separate response window must pass before anyone can finalize release. Check in or veto before release to reset your plan."],
  ["Only the vault's assets are covered", "This web preview supports SOL deposits. Assets elsewhere in your wallet, staking accounts, and DeFi positions are not automatically included. SPL-token instructions exist at program level; token management is not available in this interface yet."],
  ["Reminders are your responsibility today", "Email and other notification channels are not available in this preview. Keep your own check-in reminders and tell beneficiaries which wallet you named. An on-chain waiting period does not guarantee that you receive a message."],
  ["The program is upgradeable", "An upgrade authority can change the program. This is an unaudited devnet prototype, not an immutable or production-certified service. Use test SOL only."],
  ["Your plan is public on-chain", "Vault addresses, beneficiary wallets, percentages, and activity are visible on Solana. A wallet address is not a private identity or an encrypted message."],
  ["Completion is permissionless", "Once the waiting periods are satisfied, any signer can finalize and distribute to the stored beneficiaries. The company does not need to approve the payout; Solana network access is still required."],
];

export default function Security() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-6">
        <span className="text-xs font-semibold tracking-wide text-pulse uppercase">Know what you&apos;re signing</span>
        <h1 className="mt-4 font-display text-4xl font-bold">A clear plan needs clear limits.</h1>
        <p className="mt-4 leading-relaxed text-mist">Your beneficiaries should understand the rules as clearly as you do. Here is what this preview does, and what still needs to be built.</p>
        <div className="mt-10 space-y-4">{facts.map(([title, body]) => <section key={title} className="rounded-2xl border border-edge bg-surface p-6"><h2 className="font-display text-lg font-bold">{title}</h2><p className="mt-3 text-sm leading-relaxed text-mist">{body}</p></section>)}</div>
        <div className="mt-8 flex flex-wrap gap-4 text-sm"><a href={explorerAddr(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer" className="text-pulse underline underline-offset-4">Inspect the devnet program ↗</a><a href="https://github.com/techbone/AfterKey" target="_blank" rel="noreferrer" className="text-mist underline underline-offset-4">Read the source ↗</a><Link href="/app" className="text-mist underline underline-offset-4">Your vaults</Link></div>
      </div>
    </AppShell>
  );
}
