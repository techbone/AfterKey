"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import type { ProofOfLife } from "../../../../packages/program/proof_of_life";
import { IDL } from "./solana";

/** Read-only wallet so chain reads work before a wallet connects. */
function dummyWallet() {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey,
    signTransaction: <T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> =>
      Promise.reject(new Error("connect a wallet first")),
    signAllTransactions: <T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> =>
      Promise.reject(new Error("connect a wallet first")),
  };
}

export function useProgram(): { program: Program<ProofOfLife>; owner: PublicKey | null } {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    const provider = new AnchorProvider(connection, wallet ?? dummyWallet(), {
      commitment: "confirmed",
    });
    return new Program<ProofOfLife>(IDL as ProofOfLife, provider);
  }, [connection, wallet]);

  return { program, owner: wallet?.publicKey ?? null };
}
