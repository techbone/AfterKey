"use client";

import dynamic from "next/dynamic";

// ssr:false — the wallet modal reads window/localStorage.
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);
