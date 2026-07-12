"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { Countdown } from "@/components/countdown";
import {
  useDistributeSol,
  useFinalizeClaim,
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="heartbeat text-pulse">●</span> Proof of Life
        </Link>
        <WalletButton />
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-24">{children}</div>
    </main>
  );
}

function ClaimCard({ vault, me }: { vault: VaultData; me: string }) {
  const now = useNow();
  const { data: balance } = useVaultBalance(vault.address);
  const initiate = useInitiateClaim();
  const finalize = useFinalizeClaim();
  const distribute = useDistributeSol();

  const myShare = vault.beneficiaries.find((b) => b.key.toBase58() === me);
  const claimableAt = vault.lastCheckin.toNumber() + vault.inactivityPeriod.toNumber();
  const challengeEndsAt =
    vault.claimInitiatedAt.toNumber() + vault.challengePeriod.toNumber();
  const busy = initiate.isPending || finalize.isPending || distribute.isPending;
  const err = initiate.error ?? finalize.error ?? distribute.error ?? null;

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
        {balance !== undefined ? `${balance} SOL` : "…"}{" "}
        <span className="text-lg text-mist">in vault</span>
      </div>

      {/* State 1: active, not yet claimable */}
      {vault.state === "active" && now < claimableAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            This inheritance isn&apos;t available yet — the owner is still proving they&apos;re
            alive. If they stay silent, you&apos;ll be able to start a claim when this reaches
            zero.
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
            disabled={busy}
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
            <Countdown deadline={challengeEndsAt} totalSecs={vault.challengePeriod.toNumber()} />
          </div>
        </div>
      )}

      {/* State 4: in challenge, window elapsed → finalize */}
      {vault.state === "inChallenge" && now >= challengeEndsAt && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            The waiting period has passed with no response. Complete the inheritance to move the
            vault into release.
          </p>
          <button
            onClick={() => finalize.mutate(vault.address)}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {finalize.isPending ? "Signing…" : "Complete the inheritance"}
          </button>
        </div>
      )}

      {/* State 5: released → distribute */}
      {vault.state === "released" && (
        <div className="mt-8">
          <p className="text-sm text-mist">
            This inheritance is ready. Releasing sends every beneficiary their share in a single
            transaction — including yours.
          </p>
          <button
            onClick={() =>
              distribute.mutate({ vault: vault.address, beneficiaries: vault.beneficiaries })
            }
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
          >
            {distribute.isPending ? "Signing…" : "Receive inheritance"}
          </button>
        </div>
      )}

      {err && <p className="mt-4 text-sm break-all text-danger">{String(err).slice(0, 200)}</p>}
    </div>
  );
}

export default function ClaimPage() {
  const { connected, publicKey } = useWallet();
  const { data: vaults, isLoading } = useVaultsForMe();

  if (!connected || !publicKey) {
    return (
      <Shell>
        <div className="mx-auto max-w-md pt-24 text-center">
          <h1 className="font-display text-3xl font-bold">Claim an inheritance</h1>
          <p className="mt-3 text-mist">
            Connect the wallet you were named with to see any vaults left to you.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton />
          </div>
        </div>
      </Shell>
    );
  }

  const me = publicKey.toBase58();

  return (
    <Shell>
      <div className="pt-6">
        <h1 className="font-display text-3xl font-bold">Inheritances naming you</h1>
        <p className="mt-2 text-sm text-mist">
          Vaults where {shortKey(publicKey)} is a beneficiary.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {isLoading && <p className="text-mist">Searching the chain…</p>}
        {!isLoading && !vaults?.length && (
          <div className="rounded-3xl border border-dashed border-edge p-16 text-center">
            <p className="font-display text-xl font-bold">Nothing here</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
              No vault currently names this wallet as a beneficiary. If you were expecting one,
              check you&apos;re connected with the right wallet.
            </p>
          </div>
        )}
        {vaults?.map((v) => <ClaimCard key={v.address.toBase58()} vault={v} me={me} />)}
      </div>
    </Shell>
  );
}
