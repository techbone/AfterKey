import Link from "next/link";
import { PROGRAM_ID, explorerAddr } from "@/lib/solana";

const steps = [
  {
    n: "01",
    title: "Create a vault",
    body: "Deposit test SOL into your vault. Name your beneficiaries and their shares. Choose an inactivity period and a final response window.",
  },
  {
    n: "02",
    title: "Live your life",
    body: "Check in, deposit, or withdraw to reset your timer. You keep control until release. Keep your own reminders while email notifications are being built.",
  },
  {
    n: "03",
    title: "If you go silent",
    body: "After your timer ends, a beneficiary may start a claim. A separate response window gives you time to veto. If you do not respond before release, your beneficiaries can receive their shares.",
  },
];

const guarantees = [
  ["No key handover", "Your wallet signs the plan. Beneficiaries use their own wallets. Withdraw or cancel before the vault is released."],
  ["Two waiting periods", "The program checks both inactivity and a final response window before release. It measures silence, not verified death."],
  ["We are not required", "If this company vanished tomorrow, every inheritance still completes. Anyone can finalize a legitimate claim — permissionlessly."],
];

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pulse-glow pointer-events-none absolute inset-0" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="heartbeat text-pulse">●</span> AfterKey
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/claim"
            className="rounded-full border border-edge px-5 py-2 text-sm font-semibold text-snow transition hover:border-mist"
          >
            Claim
          </Link>
          <Link
            href="/app"
            className="rounded-full bg-pulse px-5 py-2 text-sm font-semibold text-[#04120b] transition hover:bg-[#2bd18c]"
          >
            Launch App
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-24 pb-20 text-center sm:pt-32">
        <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-7xl">
          If you died tonight,
          <br />
          <span className="text-pulse">what happens to your SOL?</span>
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-mist">
          Wills can&apos;t sign transactions. Sharing a seed phrase puts your keys at risk. AfterKey is a
          non-custodial dead-man&apos;s switch on Solana — your assets pass to the people you chose,
          without anyone ever touching your keys.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/app"
            className="rounded-full bg-pulse px-8 py-3.5 font-semibold text-[#04120b] transition hover:bg-[#2bd18c]"
          >
            Create your vault
          </Link>
          <a
            href="#how"
            className="rounded-full border border-edge px-8 py-3.5 font-semibold text-snow transition hover:border-mist"
          >
            How it works
          </a>
        </div>
        <p className="mt-6 text-xs tracking-wide text-mist uppercase">
          Live on Solana devnet · non-custodial · open source
        </p>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-edge bg-surface p-8">
              <div className="font-display text-sm font-bold text-pulse">{s.n}</div>
              <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center font-display text-3xl font-bold">
          Your plan. <span className="text-pulse">Clear rules.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-mist">
          Know how inheritance works before asking your wallet to sign.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {guarantees.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-edge p-8">
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-mist">Unaudited, upgradeable devnet preview · test assets only. <Link href="/security" className="text-pulse underline underline-offset-4">Understand the limits</Link></p>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl border-t border-edge px-6 py-10 text-sm text-mist">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>
            <span className="heartbeat text-pulse">●</span> AfterKey — inheritance,
            without the key handover.
          </span>
          <a
            className="underline-offset-4 hover:underline"
            href={explorerAddr(PROGRAM_ID.toBase58())}
            target="_blank"
            rel="noreferrer"
          >
            program: {PROGRAM_ID.toBase58().slice(0, 8)}… (devnet)
          </a>
        </div>
      </footer>
    </main>
  );
}
