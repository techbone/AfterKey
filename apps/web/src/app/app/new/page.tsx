"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { useCreateVault } from "@/hooks/useVault";
import { CHALLENGE_PRESETS, INACTIVITY_PRESETS } from "@/lib/solana";

interface Row {
  address: string;
  percent: string;
}

function humanDuration(secs: number) {
  if (secs < 3600) return `${Math.round(secs / 60)} minutes`;
  if (secs < 86_400 * 60) return `${Math.round(secs / 86_400)} days`;
  return `${Math.round(secs / 86_400 / 30)} months`;
}

export default function NewVault() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const create = useCreateVault();

  const [inactivity, setInactivity] = useState(INACTIVITY_PRESETS[1].seconds);
  const [challenge, setChallenge] = useState(CHALLENGE_PRESETS[1].seconds);
  const [rows, setRows] = useState<Row[]>([{ address: "", percent: "100" }]);
  const [deposit, setDeposit] = useState("0.1");
  const [error, setError] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const totalPct = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);

  async function submit() {
    setError(null);
    try {
      const beneficiaries = rows.map((r) => {
        const key = new PublicKey(r.address.trim()); // throws on invalid
        if (publicKey && key.equals(publicKey))
          throw new Error("You can't be your own beneficiary.");
        return { key, shareBps: Math.round(Number(r.percent) * 100) };
      });
      if (totalPct !== 100) throw new Error("Shares must add up to exactly 100%.");
      await create.mutateAsync({
        inactivitySecs: inactivity,
        challengeSecs: challenge,
        beneficiaries,
        initialDepositSol: Number(deposit) || 0,
      });
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/app" className="text-sm text-mist hover:text-snow">
          ← Back
        </Link>
        <WalletButton />
      </header>

      <div className="mx-auto max-w-2xl px-6 pb-24">
        <h1 className="font-display text-3xl font-bold">Create your vault</h1>

        {!connected ? (
          <p className="mt-6 text-mist">Connect a wallet to continue.</p>
        ) : (
          <div className="mt-10 space-y-10">
            <section>
              <h2 className="text-xs font-semibold tracking-wide text-mist uppercase">
                1 · If I'm silent for…
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {INACTIVITY_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    onClick={() => setInactivity(p.seconds)}
                    className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                      inactivity === p.seconds
                        ? "border-pulse bg-pulse/10 text-pulse"
                        : "border-edge text-mist hover:border-mist"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold tracking-wide text-mist uppercase">
                2 · Final warning window
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {CHALLENGE_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    onClick={() => setChallenge(p.seconds)}
                    className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                      challenge === p.seconds
                        ? "border-pulse bg-pulse/10 text-pulse"
                        : "border-edge text-mist hover:border-mist"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold tracking-wide text-mist uppercase">
                3 · Who inherits
              </h2>
              <div className="mt-3 space-y-3">
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-3">
                    <input
                      value={row.address}
                      onChange={(e) => setRow(i, { address: e.target.value })}
                      placeholder="Beneficiary wallet address"
                      className="flex-1 rounded-xl border border-edge bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-pulse"
                    />
                    <div className="relative">
                      <input
                        value={row.percent}
                        onChange={(e) => setRow(i, { percent: e.target.value })}
                        inputMode="numeric"
                        className="w-24 rounded-xl border border-edge bg-surface px-4 py-3 pr-8 text-sm outline-none focus:border-pulse"
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-mist">
                        %
                      </span>
                    </div>
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                        className="text-mist hover:text-danger"
                        aria-label="remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <button
                  onClick={() => setRows((r) => [...r, { address: "", percent: "" }])}
                  disabled={rows.length >= 10}
                  className="text-pulse hover:underline disabled:opacity-40"
                >
                  + add beneficiary
                </button>
                <span className={totalPct === 100 ? "text-pulse" : "text-danger"}>
                  total: {totalPct}%
                </span>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold tracking-wide text-mist uppercase">
                4 · Initial deposit (optional)
              </h2>
              <div className="relative mt-3 w-44">
                <input
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-edge bg-surface px-4 py-3 pr-14 text-sm outline-none focus:border-pulse"
                />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm text-mist">
                  SOL
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-edge bg-surface p-6 text-sm leading-relaxed text-mist">
              <span className="font-semibold text-snow">Plain-language summary: </span>
              if you do nothing for <span className="text-pulse">{humanDuration(inactivity)}</span>,
              and then ignore <span className="text-pulse">{humanDuration(challenge)}</span> of
              final warnings, the wallets above receive your vault&apos;s assets in the shares
              shown. Until then you keep total control — withdraw, edit, or cancel anytime with
              one signature.
            </section>

            {error && <p className="text-sm break-all text-danger">{error.slice(0, 300)}</p>}

            <button
              onClick={submit}
              disabled={create.isPending}
              className="w-full rounded-2xl bg-pulse py-4 font-display text-xl font-bold text-[#04120b] transition hover:bg-[#2bd18c] disabled:opacity-50"
            >
              {create.isPending ? "Creating vault…" : "Create vault"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
