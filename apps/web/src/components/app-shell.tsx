"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./wallet-button";
import { CLUSTER } from "@/lib/solana";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold"><span className="heartbeat text-pulse" aria-hidden="true">●</span> AfterKey</Link>
        <div className="flex items-center gap-3"><span className="rounded-full border border-edge px-3 py-1 text-xs text-mist">{CLUSTER === "devnet" ? "Devnet · test SOL" : CLUSTER}</span><WalletButton /></div>
        <nav aria-label="Vault navigation" className="flex w-full gap-6 border-b border-edge pt-3 pb-4 text-sm">
          <Link href="/app" aria-current={path.startsWith("/app") ? "page" : undefined} className={path.startsWith("/app") ? "font-semibold text-pulse" : "text-mist hover:text-snow"}>Your vaults</Link>
          <Link href="/claim" aria-current={path.startsWith("/claim") ? "page" : undefined} className={path.startsWith("/claim") ? "font-semibold text-pulse" : "text-mist hover:text-snow"}>Your inheritances</Link>
          <Link href="/security" className="ml-auto text-mist hover:text-snow">How you&apos;re protected</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-5 pb-24 sm:px-6">{children}</div>
    </main>
  );
}
