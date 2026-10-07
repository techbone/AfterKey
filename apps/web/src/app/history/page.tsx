"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { RpcError, TransactionFeedback, type TransactionReceipt } from "@/components/transaction-feedback";
import { WalletButton } from "@/components/wallet-button";
import { useRecoverClosedVaultSol, useVaultBalanceLamports, useVaultHistory, type VaultData } from "@/hooks/useVault";
import { escrowPda, explorerAddr, shortKey } from "@/lib/solana";
import { formatSolLamports, recoveryAllocations, recoveryPolicy } from "@/lib/vault-recovery";

function HistoryCard({ vault, viewer, signer, onReceipt }: {
  vault: VaultData; viewer: PublicKey; signer: PublicKey | null; onReceipt: (receipt: TransactionReceipt) => void;
}) {
  const balance = useVaultBalanceLamports(vault.address);
  const recover = useRecoverClosedVaultSol();
  const [review, setReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const policy = recoveryPolicy(vault, signer ?? viewer);
  const owned = vault.owner.equals(viewer);
  const ready = !!signer && policy.canAct && balance.data !== undefined && balance.data > 0n && !balance.isError;
  const recipients = balance.data === undefined ? [] : policy.kind === "cancelled"
    ? [{ key: vault.owner, shareBps: 10_000, lamports: balance.data }]
    : recoveryAllocations(balance.data, vault.beneficiaries);

  useEffect(() => { setReview(false); setCopied(false); }, [signer?.toBase58(), viewer.toBase58()]);

  return (
    <article className="overflow-hidden rounded-3xl border border-edge bg-surface">
      <div className="border-b border-edge p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${policy.kind === "cancelled" ? "border-edge text-mist" : "border-pulse/30 bg-pulse/5 text-pulse"}`}>
            {policy.kind === "cancelled" ? "Cancelled by owner" : "Inheritance completed"}
          </span>
          <span className="text-xs text-mist">{owned ? signer ? "You created this plan" : "Created by this wallet" : signer ? "Names your wallet" : "Names the viewed wallet"}</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold">Vault {shortKey(vault.address, 6)}</h2>
          <button onClick={() => void navigator.clipboard.writeText(vault.address.toBase58()).then(() => setCopied(true)).catch(() => setCopied(false))}
            className="text-xs text-mist underline underline-offset-4" aria-label={`Copy address of vault ${vault.address.toBase58()}`}>{copied ? "Copied" : "Copy address"}</button>
          <a href={explorerAddr(vault.address.toBase58())} target="_blank" rel="noreferrer" className="text-xs text-pulse underline underline-offset-4">View record ↗</a>
        </div>
        <p className="mt-2 text-sm text-mist">Owner <a href={explorerAddr(vault.owner.toBase58())} target="_blank" rel="noreferrer" className="underline underline-offset-4">{shortKey(vault.owner, 6)}</a></p>
        <p className="mt-2 text-xs text-mist">Last owner activity: {new Date(vault.lastCheckin.toNumber() * 1000).toLocaleString()}</p>
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_1.3fr] sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">SOL waiting in escrow</p>
          <p className="mt-3 break-words font-display text-3xl font-bold">{balance.data === undefined ? "…" : formatSolLamports(balance.data)} <span className="text-base font-normal text-mist">SOL</span></p>
          {balance.isError && <p role="alert" className="mt-3 text-sm text-danger">Balance unavailable. <button onClick={() => void balance.refetch()} className="underline">Retry balance</button></p>}
          {!balance.isError && balance.data === 0n && <p className="mt-3 text-sm text-mist">No SOL is waiting. This record stays available if assets arrive later.</p>}
          <a href={explorerAddr(escrowPda(vault.address).toBase58())} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-pulse underline underline-offset-4">Inspect SOL escrow ↗</a>
          <p className="mt-4 text-xs leading-relaxed text-mist">Record rent stays locked. Token balances are not shown here; token recovery uses program tools today.</p>
        </div>
        <div className="rounded-2xl border border-edge bg-ink/50 p-5">
          <h3 className="text-sm font-semibold">{policy.kind === "cancelled" ? "Recovery belongs to the owner" : "The saved shares still apply"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-mist">{policy.kind === "cancelled"
            ? "Only the owner can withdraw remaining SOL. The plan stays closed, and beneficiaries cannot start another claim."
            : "Remaining SOL goes to the original beneficiaries. Any signer can distribute it; the owner cannot withdraw it as their own funds."}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">{policy.kind === "cancelled" ? "Originally named" : "Saved beneficiaries"}</p>
          <ul className="mt-2 space-y-2">{vault.beneficiaries.map(b => <li key={b.key.toBase58()} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <a href={explorerAddr(b.key.toBase58())} target="_blank" rel="noreferrer" className="font-mono text-mist underline underline-offset-4">{shortKey(b.key, 6)}{b.key.equals(viewer) ? signer ? " · you" : " · viewed wallet" : ""}</a>
            <span>{b.shareBps / 100}%</span>
          </li>)}</ul>
        </div>
      </div>

      {balance.data !== undefined && balance.data > 0n && !balance.isError && (
        <div className="border-t border-edge p-6 sm:p-8">
          {!signer ? <p className="text-sm text-mist">Connect your wallet to take an action. Connecting switches this view to your own records.</p>
            : !policy.canAct ? <p className="text-sm text-mist">This SOL can be recovered by the owner wallet {shortKey(vault.owner, 6)}.</p>
            : !review ? <button onClick={() => setReview(true)} className="rounded-full bg-pulse px-6 py-3 text-sm font-semibold text-[#04120b]">{policy.kind === "cancelled" ? "Review SOL recovery" : "Review remaining payout"}</button>
            : <div className="rounded-2xl border border-pulse/30 bg-pulse/5 p-5">
              <h3 className="font-display text-lg font-bold">{policy.kind === "cancelled" ? "Return SOL to your wallet" : "Pay every saved beneficiary"}</h3>
              <p className="mt-2 text-sm text-mist">One wallet approval. This record remains closed and its rent is retained. Transaction fees are paid separately by the signer.</p>
              <ul className="mt-4 space-y-3">{recipients.map(b => <li key={b.key.toBase58()} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="break-all font-mono text-xs text-mist">{b.key.toBase58()}</span>
                <span className="font-semibold text-pulse">{formatSolLamports(b.lamports)} SOL</span>
              </li>)}</ul>
              <p className="mt-4 text-xs text-mist">Amounts reflect the current balance. The latest on-chain balance and saved recipients are checked before signing.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button disabled={!ready || recover.isPending} onClick={() => void recover.mutateAsync(vault.address).then(receipt => { setReview(false); onReceipt(receipt); }).catch(() => {})}
                  className="rounded-full bg-pulse px-6 py-3 text-sm font-semibold text-[#04120b] disabled:opacity-50">{recover.isPending ? "Confirming…" : policy.kind === "cancelled" ? "Recover SOL" : "Distribute remaining SOL"}</button>
                <button disabled={recover.isPending} onClick={() => setReview(false)} className="rounded-full border border-edge px-6 py-3 text-sm disabled:opacity-50">Back</button>
              </div>
            </div>}
        </div>
      )}
      {(recover.isPending || recover.error) && <div className="border-t border-edge px-6 pb-6 sm:px-8"><TransactionFeedback action={{ isPending: recover.isPending, error: recover.error }} /></div>}
    </article>
  );
}

export default function HistoryPage() {
  const { publicKey } = useWallet();
  const [lookup, setLookup] = useState<PublicKey | null>(null);
  const [input, setInput] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const [filter, setFilter] = useState<"all" | "cancelled" | "inherited">("all");
  const [limit, setLimit] = useState(8);
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const viewer = publicKey ?? lookup;
  const history = useVaultHistory(viewer);
  useEffect(() => { setReceipt(undefined); setLimit(8); setFilter("all"); }, [viewer?.toBase58(), publicKey?.toBase58()]);
  const records = history.data ?? [];
  const cancelled = records.filter(v => v.claimer.equals(PublicKey.default)).length;
  const visible = records.filter(v => filter === "all" || recoveryPolicy(v, viewer!).kind === filter);

  return (
    <AppShell>
      <div className="max-w-2xl pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-pulse">History & recovery</p>
        <h1 className="mt-3 font-display text-4xl font-bold">A closed plan still has a record.</h1>
        <p className="mt-4 leading-relaxed text-mist">Revisit cancelled plans and completed inheritances. If SOL arrives later, the original recovery rights remain in place.</p>
      </div>

      {!publicKey && <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 sm:p-8" aria-label="Choose a wallet to view">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Your wallet, your records</h2><p className="mt-2 text-sm text-mist">Connect to recover SOL, or look up public records without signing.</p></div><WalletButton /></div>
        <form className="mt-6" onSubmit={event => { event.preventDefault(); try { setLookup(new PublicKey(input.trim())); setLookupError(undefined); } catch { setLookupError("Enter a valid Solana public wallet address."); } }}>
          <label htmlFor="history-wallet" className="text-sm font-semibold">Public wallet address</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="history-wallet" value={input} onChange={event => setInput(event.target.value)} placeholder="Solana wallet address" autoComplete="off" spellCheck={false}
            aria-invalid={!!lookupError} aria-describedby={lookupError ? "history-wallet-error" : undefined} className="min-w-0 flex-1 rounded-xl border border-edge bg-ink px-4 py-3 text-sm" />
            <button className="rounded-xl border border-pulse/50 px-5 py-3 text-sm font-semibold text-pulse">View history</button></div>
          {lookupError && <p id="history-wallet-error" role="alert" className="mt-2 text-sm text-danger">{lookupError}</p>}
        </form>
      </section>}

      {viewer && <>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm"><span className="rounded-full border border-edge px-3 py-1 text-xs text-mist">{publicKey ? "Connected wallet" : "Read-only lookup"}</span>
          <span className="break-all font-mono text-mist">{viewer.toBase58()}</span></div>
        <TransactionFeedback action={{ isPending: false, error: null, data: receipt?.walletAddress === publicKey?.toBase58() ? receipt : undefined }} />
        {history.isLoading && <p role="status" className="mt-8 text-mist">Loading retained records from Solana…</p>}
        {history.isError && <div className="mt-8"><RpcError retry={() => void history.refetch()} /></div>}
        {!history.isLoading && !history.isError && <>
          <div className="mt-6 grid grid-cols-3 gap-3">{[["Records", records.length], ["Cancelled", cancelled], ["Completed", records.length - cancelled]].map(([label, count]) => <div key={label} className="rounded-2xl border border-edge bg-surface p-4 sm:p-5"><p className="text-xs text-mist">{label}</p><p className="mt-2 font-display text-2xl font-bold">{count}</p></div>)}</div>
          <div aria-label="Filter history" className="mt-6 flex flex-wrap gap-2">{([['all', 'All records'], ['cancelled', 'Cancelled'], ['inherited', 'Completed']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(8); }}
            className={`rounded-full border px-4 py-2 text-sm ${filter === value ? "border-pulse/40 bg-pulse/10 text-pulse" : "border-edge text-mist"}`}>{label}</button>)}</div>
          <div className="mt-6 space-y-6">
            {!visible.length && <div className="rounded-3xl border border-dashed border-edge p-8 text-center sm:p-12"><h2 className="font-display text-xl font-bold">{records.length ? "No records in this filter" : "No closed plans yet"}</h2><p className="mt-3 text-sm text-mist">{records.length ? "Choose another filter to see this wallet's other records." : "Cancelled vaults and completed inheritances involving this wallet will appear here."}</p><Link href="/app" className="mt-5 inline-block text-sm text-pulse underline underline-offset-4">View active vaults</Link></div>}
            {visible.slice(0, limit).map(vault => <HistoryCard key={`${viewer.toBase58()}:${vault.address.toBase58()}`} vault={vault} viewer={viewer} signer={publicKey} onReceipt={setReceipt} />)}
          </div>
          {visible.length > limit && <button onClick={() => setLimit(n => n + 8)} className="mt-6 rounded-full border border-edge px-6 py-3 text-sm">Show more records</button>}
          <p className="mt-8 text-xs leading-relaxed text-mist">These are retained vault records from the current devnet program, not a complete transaction timeline. Open a record in Explorer for its on-chain transactions. Older deployments have separate records.</p>
        </>}
      </>}
    </AppShell>
  );
}
