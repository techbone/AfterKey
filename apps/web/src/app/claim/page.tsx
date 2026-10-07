"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { AppShell } from "@/components/app-shell";
import { RpcError, TransactionFeedback, type TransactionReceipt } from "@/components/transaction-feedback";
import { Countdown } from "@/components/countdown";
import {
  useReceiveInheritance,
  useInitiateClaim,
  useVaultsForMe,
  useVaultBalance,
  type VaultData,
} from "@/hooks/useVault";
import { explorerAddr, shortKey } from "@/lib/solana";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function ClaimCard({ vault, me, onReceipt }: { vault: VaultData; me: string; onReceipt: (receipt: TransactionReceipt) => void }) {
  const now = useNow();
  const { data: balance, isError: balanceError, refetch: refreshBalance } = useVaultBalance(vault.address);
  const initiate = useInitiateClaim();
  const receive = useReceiveInheritance();

  const myShare = vault.beneficiaries.find((b) => b.key.toBase58() === me);
  const claimableAt = vault.lastCheckin.toNumber() + vault.inactivityPeriod.toNumber() + 1;
  const challengeEndsAt =
    vault.claimInitiatedAt.toNumber() + vault.challengePeriod.toNumber() + 1;
  const busy = initiate.isPending || receive.isPending;
  const action = [initiate, receive].reduce((latest, item) => item.submittedAt > latest.submittedAt ? item : latest);

  return (
    <div className="rounded-3xl border border-edge bg-surface p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={explorerAddr(vault.address.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-mist underline-offset-4 hover:underline"
        >
          from {shortKey(vault.owner, 6)} · vault {shortKey(vault.address)}
        </a>
        <span className="text-sm text-mist">
          your share:{" "}
          <span className="font-display text-lg font-bold text-pulse">
            {myShare ? myShare.shareBps / 100 : 0}%
          </span>
        </span>
      </div>

      <div className="mt-3 font-display text-3xl font-bold">
        {balance !== undefined ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL` : "…"}{" "}
        <span className="text-lg text-mist">in vault</span>
      </div>

      {balanceError && <p role="alert" className="mt-3 text-sm text-danger">Balance unavailable. <button onClick={() => refreshBalance()} className="underline">Retry balance</button></p>}
      {balance !== undefined && myShare && <p className="mt-2 text-sm text-pulse">Your expected share: {(balance * myShare.shareBps / 10_000).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL <span className="text-mist">before transaction fees; rounding is settled on-chain</span></p>}

      {/* State 1: active, not yet claimable */}
      {vault.state === "active" && now < claimableAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            The owner&apos;s inactivity timer is still running. You may start a claim if it
            expires without another check-in.
          </p>
          <div className="mt-4">
            <Countdown deadline={claimableAt} totalSecs={vault.inactivityPeriod.toNumber()} />
          </div>
        </div>
      )}

      {/* State 2: active, claimable now */}
      {vault.state === "active" && now >= claimableAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            The owner has been silent past their limit. You can start a claim now. This opens a
            final warning window — if the owner is alive, they can still cancel with one
            signature. If they stay silent through it, the assets become yours.
          </p>
          <button
            onClick={() => initiate.mutate(vault.address)}
            disabled={busy || balance === undefined}
            className="mt-6 w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {initiate.isPending ? "Signing…" : "Start a claim"}
          </button>
        </div>
      )}

      {/* State 3: in challenge, window still open */}
      {vault.state === "inChallenge" && now < challengeEndsAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            A claim is underway{" "}
            {vault.claimer.toBase58() === me ? "(started by you)" : ""}. This is the owner&apos;s
            final chance to respond. If they stay silent until the countdown ends, you can
            complete the inheritance.
          </p>
          <div className="mt-4">
            <Countdown deadline={challengeEndsAt} totalSecs={vault.challengePeriod.toNumber()} kind="challenge" />
          </div>
        </div>
      )}

      {/* State 4: in challenge, window elapsed → finalize */}
      {vault.state === "inChallenge" && now >= challengeEndsAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            The waiting period has passed with no response. One approval releases the vault,
            sends every beneficiary their SOL share, and completes the inheritance.
          </p>
          <button
            onClick={() => void receive.mutateAsync(vault.address).then(onReceipt).catch(() => {})}
            disabled={busy || balance === undefined}
            className="mt-6 w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {receive.isPending ? "Signing…" : "Receive inheritance"}
          </button>
        </div>
      )}

      {/* State 5: released → distribute (or finish, if already drained) */}
      {vault.state === "released" && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            {balance === undefined ? "Loading the confirmed SOL balance…" : balance > 0
              ? "This inheritance is ready. One approval sends every beneficiary their SOL share — including yours — and completes this inheritance."
              : "SOL has already been distributed. Finish this inheritance to clear it from your list. Its on-chain record is retained for token recovery; record rent stays locked."}
          </p>
          <button
            onClick={() =>
              void receive.mutateAsync(vault.address).then(onReceipt).catch(() => {})
            }
            disabled={busy || balance === undefined}
            className="mt-6 w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {receive.isPending ? "Signing…" : (balance ?? 0) > 0 ? "Receive inheritance" : "Finish & clear"}
          </button>
        </div>
      )}

      <TransactionFeedback action={action} />
    </div>
  );
}

export default function ClaimPage() {
  const { connected, publicKey } = useWallet();
  const { data: vaults, isLoading, isError, refetch } = useVaultsForMe();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  useEffect(() => setReceipt(undefined), [publicKey?.toBase58()]);

  if (!connected || !publicKey) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md pt-24 text-center">
          <h1 className="font-display text-3xl font-bold">Claim an inheritance</h1>
          <p className="mt-3 text-mist">
            Connect the wallet you were named with to see your inheritances. Use a browser with a Solana wallet installed and set it to devnet.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton />
          </div>
        </div>
      </AppShell>
    );
  }

  const me = publicKey.toBase58();

  return (
    <AppShell>
      <div className="pt-6">
        <h1 className="font-display text-3xl font-bold">Inheritances naming you</h1>
        <p className="mt-2 text-sm text-mist">
          Vaults where {shortKey(publicKey)} is a beneficiary.
        </p>
        <p className="mt-2 text-sm text-mist">Completed inheritances remain in <Link href="/history" className="text-pulse underline underline-offset-4">History & recovery</Link>.</p>
      </div>

      <TransactionFeedback action={{ isPending: false, error: null, data: receipt?.walletAddress === publicKey?.toBase58() ? receipt : undefined }} />
      <div className="mt-8 space-y-8">
        {isLoading && <p className="text-mist">Searching the chain…</p>}
        {isError && <RpcError retry={() => refetch()} />}
        {!isLoading && !isError && !vaults?.length && (
          <div className="rounded-3xl border border-dashed border-edge p-16 text-center">
            <p className="font-display text-xl font-bold">Nothing here</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
              No pending inheritance names this wallet. Completed and cancelled plans are cleared
              from this list. If you expected an inheritance, check you&apos;re using the named wallet.
            </p>
          </div>
        )}
        {vaults?.map((v) => <ClaimCard key={v.address.toBase58()} vault={v} me={me} onReceipt={setReceipt} />)}
      </div>
    </AppShell>
  );
}
