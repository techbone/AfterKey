"use client";

import { explorerTx } from "@/lib/solana";
import { transactionError } from "@/lib/vault-validation";

export interface TransactionReceipt {
  signature: string;
  message: string;
  vaultAddress?: string;
  walletAddress?: string;
}

export function TransactionFeedback({ action }: {
  action: { isPending: boolean; error: unknown; data?: TransactionReceipt };
}) {
  if (action.isPending) return <p role="status" className="mt-4 text-sm text-mist">Approve the action in your wallet, then wait for Solana to confirm it.</p>;
  if (action.error) return <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{transactionError(action.error)}</p>;
  if (!action.data) return null;
  return (
    <div role="status" className="mt-4 rounded-xl border border-pulse/30 bg-pulse/5 p-4 text-sm">
      <p className="text-pulse">{action.data.message}</p>
      <a href={explorerTx(action.data.signature)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-mist underline underline-offset-4">View confirmed transaction ↗</a>
    </div>
  );
}

export function RpcError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-6">
      <p className="font-semibold">We couldn&apos;t load your vaults</p>
      <p className="mt-2 text-sm text-mist">Solana isn&apos;t responding right now. This doesn&apos;t mean your vaults or funds are gone.</p>
      <button onClick={retry} className="mt-4 rounded-full border border-edge px-5 py-2 text-sm hover:border-pulse">Try again</button>
    </div>
  );
}
