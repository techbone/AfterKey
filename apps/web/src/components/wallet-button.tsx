"use client";

import dynamic from "next/dynamic";

// ssr:false — the wallet modal reads window/localStorage.
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    loading: () => <span role="status" className="inline-flex h-[42px] items-center rounded-full border border-edge px-5 text-sm text-mist">Loading wallet…</span>,
  },
);
