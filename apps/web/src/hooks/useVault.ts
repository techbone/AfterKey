"use client";

import { BN } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProgram } from "@/lib/useProgram";
import { escrowPda } from "@/lib/solana";

export interface Beneficiary {
  key: PublicKey;
  shareBps: number;
}

export interface VaultData {
  address: PublicKey;
  owner: PublicKey;
  vaultId: BN;
  state: "active" | "inChallenge" | "released" | "closed";
  inactivityPeriod: BN;
  challengePeriod: BN;
  lastCheckin: BN;
  claimInitiatedAt: BN;
  claimer: PublicKey;
  beneficiaries: Beneficiary[];
}

// anchor renders the state enum as e.g. { active: {} }
function stateName(s: Record<string, unknown>): VaultData["state"] {
  return Object.keys(s)[0] as VaultData["state"];
}

/** All vaults owned by the connected wallet (memcmp on owner at offset 8). */
export function useMyVaults() {
  const { program, owner } = useProgram();
  return useQuery({
    queryKey: ["vaults", owner?.toBase58()],
    enabled: !!owner,
    refetchInterval: 15_000,
    queryFn: async (): Promise<VaultData[]> => {
      const accounts = await program.account.vault.all([
        { memcmp: { offset: 8, bytes: owner!.toBase58() } },
      ]);
      return accounts.map(({ publicKey, account }) => ({
        address: publicKey,
        owner: account.owner,
        vaultId: account.vaultId,
        state: stateName(account.state),
        inactivityPeriod: account.inactivityPeriod,
        challengePeriod: account.challengePeriod,
        lastCheckin: account.lastCheckin,
        claimInitiatedAt: account.claimInitiatedAt,
        claimer: account.claimer,
        beneficiaries: account.beneficiaries,
      }));
    },
  });
}

/** SOL balance of a vault's escrow. */
export function useVaultBalance(vault: PublicKey | null) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["vault-balance", vault?.toBase58()],
    enabled: !!vault,
    refetchInterval: 15_000,
    queryFn: async () => {
      const lamports = await connection.getBalance(escrowPda(vault!));
      return lamports / LAMPORTS_PER_SOL;
    },
  });
}

function useVaultMutation<TArgs>(fn: (args: TArgs) => Promise<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({ queryKey: ["vault-balance"] });
    },
  });
}

export function useCheckIn() {
  const { program } = useProgram();
  return useVaultMutation((vault: PublicKey) =>
    program.methods.checkIn().accounts({ vault }).rpc(),
  );
}

export function useVetoClaim() {
  const { program } = useProgram();
  return useVaultMutation((vault: PublicKey) =>
    program.methods.vetoClaim().accounts({ vault }).rpc(),
  );
}

export function useDepositSol() {
  const { program } = useProgram();
  return useVaultMutation(({ vault, sol }: { vault: PublicKey; sol: number }) =>
    program.methods
      .depositSol(new BN(Math.round(sol * LAMPORTS_PER_SOL)))
      .accounts({ vault })
      .rpc(),
  );
}

export function useWithdrawSol() {
  const { program } = useProgram();
  return useVaultMutation(({ vault, sol }: { vault: PublicKey; sol: number }) =>
    program.methods
      .withdrawSol(new BN(Math.round(sol * LAMPORTS_PER_SOL)))
      .accounts({ vault })
      .rpc(),
  );
}

export function useCreateVault() {
  const { program, owner } = useProgram();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inactivitySecs,
      challengeSecs,
      beneficiaries,
      initialDepositSol,
    }: {
      inactivitySecs: number;
      challengeSecs: number;
      beneficiaries: Beneficiary[];
      initialDepositSol: number;
    }) => {
      if (!owner) throw new Error("connect a wallet first");
      const vaultId = new BN(Date.now());
      const sig = await program.methods
        .initializeVault(vaultId, new BN(inactivitySecs), new BN(challengeSecs), beneficiaries)
        .accounts({ owner })
        .rpc();
      if (initialDepositSol > 0) {
        const { vaultPda } = await import("@/lib/solana");
        await program.methods
          .depositSol(new BN(Math.round(initialDepositSol * LAMPORTS_PER_SOL)))
          .accounts({ vault: vaultPda(owner, vaultId) })
          .rpc();
      }
      return sig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vaults"] }),
  });
}
