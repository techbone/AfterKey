"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { AppShell } from "@/components/app-shell";
import { RpcError, TransactionFeedback, type TransactionReceipt } from "@/components/transaction-feedback";
import { solToLamports } from "@/lib/vault-validation";
import { Countdown } from "@/components/countdown";
import {
  useCancelVault,
  useCheckIn,
  useDepositSol,
  useMyVaults,
  useVaultBalance,
  useVetoClaim,
  useWithdrawSol,
  type VaultData,
} from "@/hooks/useVault";
import { explorerAddr, shortKey } from "@/lib/solana";

function VaultCard({ vault, onReceipt }: { vault: VaultData; onReceipt: (receipt: TransactionReceipt) => void }) {
  const { data: balance, isError: balanceError, refetch: refreshBalance } = useVaultBalance(vault.address);
  const checkIn = useCheckIn();
  const veto = useVetoClaim();
  const deposit = useDepositSol();
  const withdraw = useWithdrawSol();
  const cancel = useCancelVault();
  const [amount, setAmount] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const deadline = vault.lastCheckin.toNumber() + vault.inactivityPeriod.toNumber() + 1;
  const challengeEnds =
    vault.claimInitiatedAt.toNumber() + vault.challengePeriod.toNumber() + 1;
  const busy =
    checkIn.isPending ||
    veto.isPending ||
    deposit.isPending ||
    withdraw.isPending ||
    cancel.isPending;
  const action = [checkIn, veto, deposit, withdraw, cancel].reduce((latest, item) =>
    item.submittedAt > latest.submittedAt ? item : latest,
  );
  let validAmount = false;
  let canWithdraw = false;
  let amountIssue: string | null = null;
  try {
    const lamports = solToLamports(amount);
    validAmount = true;
    canWithdraw = balance !== undefined && lamports <= BigInt(Math.round(balance * 1_000_000_000));
  } catch (e) { if (amount.trim()) amountIssue = e instanceof Error ? e.message : String(e); }
  const canCancel = vault.state === "active" || vault.state === "inChallenge";

  return (
    <div className="rounded-3xl border border-edge bg-surface p-8 sm:p-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={explorerAddr(vault.address.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-mist underline-offset-4 hover:underline"
        >
          vault {shortKey(vault.address)}
        </a>
        <span className="font-display text-2xl font-bold">
          {balance !== undefined ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL` : "…"}
        </span>
      </div>

      {balanceError && <p role="alert" className="mt-3 text-sm text-danger">Balance unavailable. <button onClick={() => refreshBalance()} className="underline">Retry balance</button></p>}
      <p className="mt-3 text-xs tracking-wide text-mist uppercase">{vault.state === "inChallenge" ? "Owner response window" : vault.state === "released" ? "Ready for beneficiaries" : "Active · you keep control"}</p>

      {vault.state === "active" && (
        <>
          <div className="mt-8">
            <Countdown deadline={deadline} totalSecs={vault.inactivityPeriod.toNumber()} />
          </div>
          <button
            onClick={() => checkIn.mutate(vault.address)}
            disabled={busy}
            className="mt-8 w-full rounded-2xl bg-pulse py-5 font-display text-2xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {checkIn.isPending ? "Signing…" : "I'm alive"}
          </button>
        </>
      )}

      {vault.state === "inChallenge" && (
        <div className="mt-8 rounded-2xl border border-danger/40 bg-danger/10 p-6">
          <h3 className="font-display text-xl font-bold text-danger">
            ⚠ A claim is in progress
          </h3>
          <p className="mt-2 text-sm text-mist">
            {shortKey(vault.claimer)} initiated an inheritance claim. If you do nothing, assets
            release after{" "}
            {new Date(challengeEnds * 1000).toLocaleString()}. One signature cancels it.
          </p>
          <button
            onClick={() => veto.mutate(vault.address)}
            disabled={busy}
            className="mt-4 w-full rounded-2xl bg-danger py-5 font-display text-2xl font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
          >
            {veto.isPending ? "Signing…" : "I'm alive — cancel this claim"}
          </button>
        </div>
      )}

      {vault.state === "released" && (
        <div className="mt-8 rounded-2xl border border-edge p-6 text-mist">
          The waiting period has ended. Beneficiaries can now receive their shares from the inheritance page.
        </div>
      )}

      {vault.state === "active" && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            aria-label="SOL amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (SOL)"
            inputMode="decimal"
            className="w-36 rounded-xl border border-edge bg-ink px-4 py-2.5 text-sm outline-none focus:border-pulse"
          />
          <button
            onClick={() => deposit.mutate({ vault: vault.address, amount }, { onSuccess: () => setAmount("") })}
            disabled={busy || !validAmount}
            className="rounded-xl border border-edge px-5 py-2.5 text-sm font-semibold transition hover:border-pulse disabled:opacity-50"
          >
            Deposit
          </button>
          <button
            onClick={() => withdraw.mutate({ vault: vault.address, amount }, { onSuccess: () => setAmount("") })}
            disabled={busy || !validAmount || !canWithdraw}
            className="rounded-xl border border-edge px-5 py-2.5 text-sm font-semibold transition hover:border-pulse disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      )}

      {amountIssue && <p role="alert" className="mt-3 text-xs text-danger">{amountIssue}</p>}
      <div className="mt-8 border-t border-edge pt-6">
        <h4 className="text-xs font-semibold tracking-wide text-mist uppercase">
          Beneficiaries
        </h4>
        <ul className="mt-3 space-y-2">
          {vault.beneficiaries.map((b) => (
            <li key={b.key.toBase58()} className="flex justify-between text-sm">
              <span className="font-mono">{shortKey(b.key, 6)}</span>
              <span className="text-pulse">{b.shareBps / 100}%</span>
            </li>
          ))}
        </ul>
      </div>

      {canCancel && (
        <div className="mt-8 border-t border-edge pt-6">
          {!confirmingCancel ? (
            <button
              onClick={() => setConfirmingCancel(true)}
              className="text-xs font-semibold tracking-wide text-mist uppercase transition hover:text-danger"
            >
              Cancel this vault
            </button>
          ) : (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
              <p className="text-sm text-mist">
                This returns the vault’s SOL to your wallet and permanently cancels its inheritance. No beneficiary can start a new claim
                {vault.state === "inChallenge"
                  ? ` — including ${shortKey(vault.claimer)}, whose claim is in progress`
                  : ""}
                . The on-chain record is retained so any remaining tokens can be recovered; its rent stays locked. <span className="font-semibold text-snow">Cancellation cannot be undone.</span>
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() =>
                    void cancel.mutateAsync(vault.address)
                      .then(onReceipt)
                      .catch(() => {})
                      .finally(() => setConfirmingCancel(false))
                  }
                  disabled={busy}
                  className="rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  {cancel.isPending ? "Signing…" : "Yes, cancel and return SOL"}
                </button>
                <button
                  onClick={() => setConfirmingCancel(false)}
                  disabled={busy}
                  className="rounded-xl border border-edge px-5 py-2.5 text-sm font-semibold transition hover:border-mist"
                >
                  Keep vault
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <TransactionFeedback action={action} />
    </div>
  );
}

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const { data: vaults, isLoading, isError, refetch } = useMyVaults();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  useEffect(() => setReceipt(undefined), [publicKey?.toBase58()]);

  if (!connected) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md pt-24 text-center">
          <h1 className="font-display text-3xl font-bold">Connect your wallet</h1>
          <p className="mt-3 text-mist">
            Use a browser with a Solana wallet installed. Set your wallet to devnet to use test SOL.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between pt-6">
        <h1 className="font-display text-3xl font-bold">Your vaults</h1>
        <Link
          href="/app/new"
          className="rounded-full bg-pulse px-5 py-2 text-sm font-semibold text-[#04120b] transition hover:bg-[#2bd18c]"
        >
          + New vault
        </Link>
      </div>

      <p className="mt-3 text-sm text-mist">Closed plans live in <Link href="/history" className="text-pulse underline underline-offset-4">History & recovery</Link>.</p>
      <TransactionFeedback action={{ isPending: false, error: null, data: receipt?.walletAddress === publicKey?.toBase58() ? receipt : undefined }} />
      <div className="mt-8 space-y-8">
        {isLoading && <p className="text-mist">Loading your vaults…</p>}
        {isError && <RpcError retry={() => refetch()} />}
        {!isLoading && !isError && !vaults?.length && (
          <div className="rounded-3xl border border-dashed border-edge p-16 text-center">
            <p className="font-display text-xl font-bold">No active vaults</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
              Create one in under a minute: pick a timer, name your beneficiaries, deposit.
            </p>
            <Link
              href="/app/new"
              className="mt-6 inline-block rounded-full bg-pulse px-6 py-3 text-sm font-semibold text-[#04120b]"
            >
              Create your vault
            </Link>
          </div>
        )}
        {vaults?.map((v) => <VaultCard key={v.address.toBase58()} vault={v} onReceipt={setReceipt} />)}
      </div>
    </AppShell>
  );
}
