"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { WalletButton } from "@/components/wallet-button";
import { TransactionFeedback } from "@/components/transaction-feedback";
import { useCreateVault } from "@/hooks/useVault";
import { CHALLENGE_PRESETS, INACTIVITY_PRESETS, explorerAddr } from "@/lib/solana";
import { percentToBps, solToLamports, validateBeneficiaries } from "@/lib/vault-validation";

interface Row { address: string; percent: string }
const stageNames = ["People", "Timing", "Review & fund"];

function humanDuration(secs: number) {
  if (secs < 3600) return Math.round(secs / 60) + (secs === 60 ? " minute" : " minutes");
  if (secs < 86_400 * 60) return Math.round(secs / 86_400) + " days";
  return Math.round(secs / 86_400 / 30) + " months";
}

export default function NewVault() {
  const { connected, publicKey } = useWallet();
  const create = useCreateVault();
  const [stage, setStage] = useState(0);
  const [inactivity, setInactivity] = useState<number>(INACTIVITY_PRESETS[1].seconds);
  const [challenge, setChallenge] = useState<number>(CHALLENGE_PRESETS[1].seconds);
  const [rows, setRows] = useState<Row[]>([{ address: "", percent: "100" }]);
  const [deposit, setDeposit] = useState("0.1");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Never carry a confirmed receipt into a different wallet's creation flow.
  useEffect(() => {
    create.reset();
    setError(null);
    setStage(0);
    setRows([{ address: "", percent: "100" }]);
  }, [publicKey?.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(r => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  let totalBps: number | null = 0;
  try { totalBps = rows.reduce((sum, r) => sum + percentToBps(r.percent), 0); } catch { totalBps = null; }

  function nextStage() {
    setError(null);
    try {
      if (!publicKey) throw new Error("Connect your wallet first.");
      if (stage === 0) validateBeneficiaries(rows, publicKey);
      setStage(stage + 1);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function submit() {
    setError(null);
    try {
      if (!publicKey) throw new Error("Connect your wallet first.");
      const beneficiaries = validateBeneficiaries(rows, publicKey);
      solToLamports(deposit, true);
      await create.mutateAsync({ inactivitySecs: inactivity, challengeSecs: challenge, beneficiaries, deposit });
    } catch (e) {
      if (!create.isError) setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function copyHandoff() {
    const address = create.data?.vaultAddress;
    if (!address) return;
    const text = [
      "AfterKey inheritance instructions — Solana devnet test vault",
      "Vault: " + address,
      "Owner: " + publicKey?.toBase58(),
      ...rows.map(r => "Beneficiary: " + r.address.trim() + " — " + r.percent + "%"),
      "Inactivity period: " + humanDuration(inactivity),
      "Owner response window: " + humanDuration(challenge),
      "Open " + window.location.origin + "/claim in a browser with your beneficiary wallet connected on devnet.",
      "You may start a claim only after owner inactivity. The owner may veto during the response window. After it ends, finalize and receive the SOL inheritance.",
      "No seed phrase or private key needs to be shared. Email reminders are not available in this preview.",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError("Your browser couldn't copy the instructions. You can copy the vault address below."); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-6">
        <Link href="/app" className="text-sm text-mist hover:text-snow">← Your vaults</Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Leave a plan. Keep your keys.</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">Choose who inherits and when they may claim. Your wallet stays in control until an unanswered claim is released.</p>

        {!connected ? (
          <div className="mt-10 rounded-3xl border border-edge bg-surface p-8">
            <h2 className="font-display text-xl font-bold">Connect your owner wallet</h2>
            <p className="mt-3 mb-6 text-sm text-mist">Use a browser with a Solana wallet installed, set to devnet. This preview uses test SOL.</p>
            <WalletButton />
          </div>
        ) : create.data ? (
          <section className="mt-10 rounded-3xl border border-pulse/30 bg-surface p-8">
            <span className="text-sm text-pulse">✓ Confirmed on Solana devnet</span>
            <h2 className="mt-3 font-display text-2xl font-bold">Your inheritance plan is in place</h2>
            <TransactionFeedback action={create} />
            {create.data.vaultAddress && <a href={explorerAddr(create.data.vaultAddress)} target="_blank" rel="noreferrer" className="mt-6 block break-all font-mono text-xs text-mist underline">{create.data.vaultAddress}</a>}
            <p className="mt-6 text-sm leading-relaxed text-mist">Give your beneficiaries these instructions so they know which wallet and vault to use. No key handover required.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app" className="rounded-full bg-pulse px-6 py-3 font-semibold text-[#04120b]">View your vaults</Link>
              <button onClick={copyHandoff} className="rounded-full border border-edge px-6 py-3 text-sm">{copied ? "Instructions copied ✓" : "Copy beneficiary instructions"}</button>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
          </section>
        ) : (
          <form className="mt-10" onSubmit={e => { e.preventDefault(); if (stage < 2) nextStage(); else void submit(); }}>
            <ol aria-label="Creation progress" className="mb-8 flex gap-3">
              {stageNames.map((name, index) => <li key={name} aria-current={stage === index ? "step" : undefined} className={"flex-1 border-t-2 pt-3 text-xs sm:text-sm " + (index <= stage ? "border-pulse text-pulse" : "border-edge text-mist")}>{index + 1} · {name}</li>)}
            </ol>
            <fieldset disabled={create.isPending} className="space-y-8">
              {stage === 0 && <section className="rounded-3xl border border-edge bg-surface p-6 sm:p-8">
                <h2 className="font-display text-xl font-bold">Who should inherit?</h2>
                <p className="mt-2 text-sm text-mist">Use a different wallet for each person. Their shares must total exactly 100%.</p>
                <div className="mt-6 space-y-5">
                  {rows.map((row, i) => <div key={i} className="space-y-2">
                    <label htmlFor={"beneficiary-" + i} className="text-xs font-semibold text-mist">Beneficiary {i + 1} wallet</label>
                    <div className="flex flex-wrap gap-3">
                      <input id={"beneficiary-" + i} value={row.address} onChange={e => setRow(i, { address: e.target.value })} autoComplete="off" spellCheck={false} placeholder="Solana wallet address" className="min-w-0 basis-full rounded-xl border border-edge bg-ink px-4 py-3 font-mono text-sm outline-none focus:border-pulse sm:flex-1 sm:basis-auto" />
                      <label className="flex items-center gap-2 text-xs text-mist">Share <input aria-label={"Beneficiary " + (i + 1) + " percentage"} value={row.percent} onChange={e => setRow(i, { percent: e.target.value })} inputMode="decimal" className="w-20 rounded-xl border border-edge bg-ink px-3 py-3 text-sm text-snow outline-none focus:border-pulse" /> %</label>
                      {rows.length > 1 && <button type="button" onClick={() => setRows(r => r.filter((_, j) => j !== i))} aria-label={"Remove beneficiary " + (i + 1)} className="px-2 text-sm text-mist hover:text-danger">Remove</button>}
                    </div>
                  </div>)}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <button type="button" onClick={() => setRows(r => [...r, { address: "", percent: "" }])} disabled={rows.length >= 10} className="text-pulse disabled:opacity-40">+ Add beneficiary</button>
                  <span className={totalBps === 10_000 ? "text-pulse" : "text-danger"}>{totalBps === null ? "Check shares" : "Total: " + totalBps / 100 + "%"}</span>
                </div>
              </section>}
              {stage === 1 && <section className="space-y-8 rounded-3xl border border-edge bg-surface p-6 sm:p-8">
                <div><h2 className="font-display text-xl font-bold">How long before they may claim?</h2><p className="mt-2 text-sm text-mist">A check-in, deposit, or withdrawal resets your inactivity timer.</p>
                  <div role="group" aria-label="Inactivity period" className="mt-5 flex flex-wrap gap-2">{INACTIVITY_PRESETS.map(p => <button type="button" key={p.seconds} aria-pressed={inactivity === p.seconds} onClick={() => setInactivity(p.seconds)} className={"rounded-full border px-4 py-2.5 text-sm " + (inactivity === p.seconds ? "border-pulse bg-pulse/10 text-pulse" : "border-edge text-mist")}>{p.label}</button>)}</div>
                </div>
                <div><h3 className="font-semibold">Your final response window</h3><p className="mt-2 text-sm text-mist">After a beneficiary starts a claim, you can still cancel it with a signature before release.</p>
                  <div role="group" aria-label="Challenge period" className="mt-5 flex flex-wrap gap-2">{CHALLENGE_PRESETS.map(p => <button type="button" key={p.seconds} aria-pressed={challenge === p.seconds} onClick={() => setChallenge(p.seconds)} className={"rounded-full border px-4 py-2.5 text-sm " + (challenge === p.seconds ? "border-pulse bg-pulse/10 text-pulse" : "border-edge text-mist")}>{p.label}</button>)}</div>
                </div>
                <p className="rounded-xl border border-edge p-4 text-xs leading-relaxed text-mist">Email reminders are not available in this preview. Keep your own check-in reminder. The waiting period is enforced on-chain.</p>
              </section>}
              {stage === 2 && <section className="space-y-6 rounded-3xl border border-edge bg-surface p-6 sm:p-8">
                <h2 className="font-display text-xl font-bold">Review before signing</h2>
                <ul className="space-y-3">{rows.map((row, i) => <li key={i} className="flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-all font-mono text-xs text-mist">{row.address.trim()}</span><span className="font-semibold text-pulse">{row.percent}%</span></li>)}</ul>
                <div className="border-t border-edge pt-6"><label htmlFor="initial-deposit" className="block text-sm font-semibold">Initial deposit (test SOL)</label><input id="initial-deposit" value={deposit} onChange={e => setDeposit(e.target.value)} inputMode="decimal" className="mt-3 w-full rounded-xl border border-edge bg-ink px-4 py-3 outline-none focus:border-pulse" /><p className="mt-2 text-xs text-mist">Use 0 to fund later from this owner wallet. Keep extra test SOL for account rent and network fees.</p></div>
                <p className="rounded-2xl border border-pulse/20 bg-pulse/5 p-5 text-sm leading-relaxed text-mist">If you do nothing for <strong className="text-snow">{humanDuration(inactivity)}</strong>, your beneficiaries may start a claim. If you do not respond for another <strong className="text-snow">{humanDuration(challenge)}</strong>, the vault becomes releasable in the shares above. You can check in, withdraw, or cancel before release.</p>
                <p className="text-xs text-mist">One approval creates and funds this SOL vault together. A small account-rent deposit is kept for recovery after cancellation or completion; network fees also apply. No private key is shared. The program is upgradeable and unaudited; use devnet test assets only.</p>
              </section>}
              {error && !create.error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <TransactionFeedback action={create} />
              <div className="flex gap-3">
                {stage > 0 && <button type="button" onClick={() => { setStage(stage - 1); setError(null); create.reset(); }} className="rounded-2xl border border-edge px-6 py-4 font-semibold">Back</button>}
                <button type="submit" className="flex-1 rounded-2xl bg-pulse px-6 py-4 font-display text-lg font-bold text-[#04120b] disabled:opacity-50">{create.isPending ? "Waiting for confirmation…" : stage === 2 ? "Create & fund vault" : "Continue"}</button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </AppShell>
  );
}
