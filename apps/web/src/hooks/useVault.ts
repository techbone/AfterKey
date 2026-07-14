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

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapVault(publicKey: PublicKey, account: any): VaultData {
  return {
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
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
      return accounts.map(({ publicKey, account }) => mapVault(publicKey, account));
    },
  });
}

/**
 * Vaults naming the connected wallet as a beneficiary. Beneficiaries live in a
 * variable-offset Vec, so we can't memcmp — we fetch all vaults and filter
 * client-side. Fine for devnet/MVP scale; the backend indexer (Milestone 4)
 * replaces this with a proper query.
 */
export function useVaultsForMe() {
  const { program, owner } = useProgram();
  return useQuery({
    queryKey: ["claimable", owner?.toBase58()],
    enabled: !!owner,
    refetchInterval: 10_000,
    queryFn: async (): Promise<VaultData[]> => {
      const accounts = await program.account.vault.all();
      return accounts
        .map(({ publicKey, account }) => mapVault(publicKey, account))
        .filter((v) => v.beneficiaries.some((b) => b.key.equals(owner!)))
        .filter((v) => v.state !== "closed");
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
      queryClient.invalidateQueries({ queryKey: ["claimable"] });
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

/** Beneficiary starts a claim on a vault whose inactivity period has elapsed. */
export function useInitiateClaim() {
  const { program, owner } = useProgram();
  return useVaultMutation((vault: PublicKey) =>
    program.methods.initiateClaim().accounts({ claimer: owner!, vault }).rpc(),
  );
}

/** Anyone can finalize once the challenge window has passed (permissionless). */
export function useFinalizeClaim() {
  const { program, owner } = useProgram();
  return useVaultMutation((vault: PublicKey) =>
    program.methods.finalizeClaim().accounts({ cranker: owner!, vault }).rpc(),
  );
}

/**
 * Receive an inheritance: release SOL to all beneficiaries per their shares,
 * then finish the vault so its lifecycle completes (state → closed) and it
 * stops appearing as claimable. Permissionless. The remaining accounts MUST be
 * the beneficiary wallets in stored order — the program validates each against
 * on-chain state and pays each its share.
 *
 * `hasBalance` lets us skip the distribute transaction (and its signature) for
 * an already-drained vault — e.g. finishing one that was distributed earlier.
 */
export function useReceiveInheritance() {
  const { program, owner } = useProgram();
  return useVaultMutation(
    async ({
      vault,
      beneficiaries,
      hasBalance,
    }: {
      vault: PublicKey;
      beneficiaries: Beneficiary[];
      hasBalance: boolean;
    }) => {
      if (hasBalance) {
        await program.methods
          .distributeSol()
          .accounts({ cranker: owner!, vault })
          .remainingAccounts(
            beneficiaries.map((b) => ({ pubkey: b.key, isSigner: false, isWritable: true })),
          )
          .rpc();
      }
      return program.methods
        .closeReleasedVault()
        .accounts({ cranker: owner!, vault })
        .rpc();
    },
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

/**
 * Owner shuts the vault down entirely: withdraw every lamport (this
 * auto-vetoes if a claim is mid-challenge — one signature covers both), then
 * close the account. Afterward no beneficiary can ever claim against it
 * again; there's nothing left to veto. Irreversible — the UI must confirm
 * before calling this.
 */
export function useCancelVault() {
  const { program } = useProgram();
  return useVaultMutation(
    async ({ vault, balanceSol }: { vault: PublicKey; balanceSol: number }) => {
      if (balanceSol > 0) {
        await program.methods
          .withdrawSol(new BN(Math.round(balanceSol * LAMPORTS_PER_SOL)))
          .accounts({ vault })
          .rpc();
      }
      return program.methods.closeVault().accounts({ vault }).rpc();
    },
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
