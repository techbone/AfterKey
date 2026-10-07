"use client";

import BN from "bn.js";
import { type IdlAccounts } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, type Transaction } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProgram } from "@/lib/useProgram";
import { escrowPda, CLUSTER } from "@/lib/solana";
import { solToLamports, validateEscrowBalance } from "@/lib/vault-validation";
import { cancelVaultTransaction, createVaultTransaction, receiveInheritanceTransaction, recoverClosedVaultTransaction } from "@/lib/vault-transactions";
import { recoveryPolicy } from "@/lib/vault-recovery";
import { refreshVaultQueries } from "@/lib/vault-cache";
import type { TransactionReceipt } from "@/components/transaction-feedback";
import type { ProofOfLife } from "../../../../packages/program/proof_of_life";

export interface Beneficiary { key: PublicKey; shareBps: number }
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

function mapVault(address: PublicKey, account: IdlAccounts<ProofOfLife>["vault"]): VaultData {
  return { ...account, address, state: Object.keys(account.state)[0] as VaultData["state"] };
}

export function useMyVaults() {
  const { program, owner } = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["vaults", connection.rpcEndpoint, owner?.toBase58()],
    enabled: !!owner,
    refetchInterval: 15_000,
    queryFn: async (): Promise<VaultData[]> => {
      const accounts = await program.account.vault.all([{ memcmp: { offset: 8, bytes: owner!.toBase58() } }]);
      return accounts.map(({ publicKey, account }) => mapVault(publicKey, account)).filter(v => v.state !== "closed");
    },
  });
}

export function useVaultsForMe() {
  const { program, owner } = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["claimable", connection.rpcEndpoint, owner?.toBase58()],
    enabled: !!owner,
    refetchInterval: 10_000,
    queryFn: async (): Promise<VaultData[]> => {
      const accounts = await program.account.vault.all();
      return accounts.map(({ publicKey, account }) => mapVault(publicKey, account))
        .filter(v => v.beneficiaries.some(b => b.key.equals(owner!)) && v.state !== "closed");
    },
  });
}

export function useVaultBalance(vault: PublicKey | null) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["vault-balance", connection.rpcEndpoint, vault?.toBase58()],
    enabled: !!vault,
    refetchInterval: 15_000,
    queryFn: async () => (await connection.getBalance(escrowPda(vault!), "confirmed")) / LAMPORTS_PER_SOL,
  });
}

/** Public, read-only records; the actual connected signer controls mutations. */
export function useVaultHistory(viewer: PublicKey | null) {
  const { program } = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["vault-history", connection.rpcEndpoint, program.programId.toBase58(), viewer?.toBase58()],
    enabled: !!viewer,
    refetchInterval: 30_000,
    queryFn: async (): Promise<VaultData[]> => {
      const accounts = await program.account.vault.all();
      return accounts.map(({ publicKey, account }) => mapVault(publicKey, account))
        .filter(v => v.state === "closed" && (v.owner.equals(viewer!) || v.beneficiaries.some(b => b.key.equals(viewer!))))
        .sort((a, b) => b.vaultId.cmp(a.vaultId));
    },
  });
}

export function useVaultBalanceLamports(vault: PublicKey) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["vault-balance-lamports", connection.rpcEndpoint, vault.toBase58()],
    refetchInterval: 30_000,
    queryFn: async () => {
      const balance = await connection.getBalance(escrowPda(vault), "confirmed");
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("This SOL balance cannot be read precisely. Retry with a reliable RPC provider.");
      return BigInt(balance);
    },
  });
}

function useVaultMutation<TArgs>(fn: (args: TArgs) => Promise<TransactionReceipt>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // A confirmation timeout may still have landed on-chain. Always refresh.
    onSettled: () => refreshVaultQueries(queryClient),
  });
}

export function useRecoverClosedVaultSol() {
  const { program, owner, connection, send } = useAtomicVaultAction();
  return useVaultMutation(async (vault: PublicKey) => {
    if (!owner) throw new Error("Connect your wallet first.");
    if (CLUSTER !== "devnet") throw new Error("This preview supports Solana devnet only.");
    const account = await program.account.vault.fetch(vault);
    const balance = await connection.getBalance(escrowPda(vault), "confirmed");
    if (!Number.isSafeInteger(balance)) throw new Error("This SOL balance cannot be read precisely. Refresh before signing.");
    const policy = recoveryPolicy(account, owner);
    const tx = await recoverClosedVaultTransaction(program, owner, vault, account, BigInt(balance));
    return { signature: await send(tx), walletAddress: owner.toBase58(), vaultAddress: vault.toBase58(),
      message: policy.action === "withdraw" ? "SOL recovered to your wallet. This plan remains closed." : "Remaining SOL distributed to the saved beneficiaries. This inheritance remains completed." };
  });
}

export function useCheckIn() {
  const { program } = useProgram();
  return useVaultMutation(async (vault: PublicKey) => ({
    signature: await program.methods.checkIn().accounts({ vault }).rpc(),
    message: "Check-in confirmed. Your inactivity timer has reset.",
  }));
}

export function useVetoClaim() {
  const { program } = useProgram();
  return useVaultMutation(async (vault: PublicKey) => ({
    signature: await program.methods.vetoClaim().accounts({ vault }).rpc(),
    message: "Claim cancelled. Your vault is active and the timer has reset.",
  }));
}

export function useInitiateClaim() {
  const { program, owner } = useProgram();
  return useVaultMutation(async (vault: PublicKey) => ({
    signature: await program.methods.initiateClaim().accounts({ claimer: owner!, vault }).rpc(),
    message: "Claim started. The owner can respond during the challenge window.",
  }));
}

export function useFinalizeClaim() {
  const { program, owner } = useProgram();
  return useVaultMutation(async (vault: PublicKey) => ({
    signature: await program.methods.finalizeClaim().accounts({ cranker: owner!, vault }).rpc(),
    message: "Waiting period completed. The inheritance is ready for distribution.",
  }));
}

function useAtomicVaultAction() {
  const { program, owner } = useProgram();
  const { connection } = useConnection();
  const send = async (transaction: Transaction) => {
    if (!owner || !program.provider.sendAndConfirm) throw new Error("Connect your wallet first.");
    return program.provider.sendAndConfirm(transaction, [], { commitment: "confirmed" });
  };
  return { program, owner, connection, send };
}

export function useReceiveInheritance() {
  const { program, owner, connection, send } = useAtomicVaultAction();
  return useVaultMutation(async (vault: PublicKey) => {
    if (!owner) throw new Error("Connect your wallet first.");
    const account = await program.account.vault.fetch(vault);
    const balance = BigInt(await connection.getBalance(escrowPda(vault), "confirmed"));
    const tx = await receiveInheritanceTransaction(program, owner, vault, account.beneficiaries, balance, "inChallenge" in account.state);
    return { signature: await send(tx), walletAddress: owner.toBase58(), message: "Inheritance completed. Each beneficiary received their SOL share." };
  });
}

export function useDepositSol() {
  const { program } = useProgram();
  const { connection } = useConnection();
  return useVaultMutation(async ({ vault, amount }: { vault: PublicKey; amount: string }) => {
    const lamports = solToLamports(amount);
    const [balance, minimum] = await Promise.all([connection.getBalance(escrowPda(vault), "confirmed"), connection.getMinimumBalanceForRentExemption(0)]);
    validateEscrowBalance(BigInt(balance) + lamports, BigInt(minimum));
    return { signature: await program.methods.depositSol(new BN(lamports.toString())).accounts({ vault }).rpc(), message: "Deposit confirmed. Your balance and inactivity timer have updated." };
  });
}

export function useWithdrawSol() {
  const { program } = useProgram();
  const { connection } = useConnection();
  return useVaultMutation(async ({ vault, amount }: { vault: PublicKey; amount: string }) => {
    const lamports = solToLamports(amount);
    const [balance, minimum] = await Promise.all([connection.getBalance(escrowPda(vault), "confirmed"), connection.getMinimumBalanceForRentExemption(0)]);
    if (lamports > BigInt(balance)) throw new Error("The withdrawal exceeds the vault's current SOL balance.");
    validateEscrowBalance(BigInt(balance) - lamports, BigInt(minimum));
    return { signature: await program.methods.withdrawSol(new BN(lamports.toString())).accounts({ vault }).rpc(), message: "Withdrawal confirmed. SOL has returned to your wallet." };
  });
}

export function useCancelVault() {
  const { program, owner, connection, send } = useAtomicVaultAction();
  return useVaultMutation(async (vault: PublicKey) => {
    if (!owner) throw new Error("Connect your wallet first.");
    const account = await program.account.vault.fetch(vault);
    const balance = BigInt(await connection.getBalance(escrowPda(vault), "confirmed"));
    const tx = await cancelVaultTransaction(program, owner, vault, balance, "inChallenge" in account.state);
    return { signature: await send(tx), walletAddress: owner.toBase58(), message: "Vault cancelled. Its SOL has returned to your wallet." };
  });
}

export function useCreateVault() {
  const { program, owner, connection, send } = useAtomicVaultAction();
  return useVaultMutation(async ({ inactivitySecs, challengeSecs, beneficiaries, deposit }: {
    inactivitySecs: number; challengeSecs: number; beneficiaries: Beneficiary[]; deposit: string;
  }) => {
    if (!owner) throw new Error("Connect your wallet first.");
    if (CLUSTER !== "devnet") throw new Error("This preview supports Solana devnet only.");
    const lamports = solToLamports(deposit, true);
    if (lamports > 0n) validateEscrowBalance(lamports, BigInt(await connection.getMinimumBalanceForRentExemption(0)));
    const vaultId = new BN(Date.now());
    const { transaction, vault } = await createVaultTransaction(program, owner, vaultId, inactivitySecs, challengeSecs, beneficiaries, lamports);
    return { signature: await send(transaction), vaultAddress: vault.toBase58(), message: "Vault created. Your beneficiaries, timer, and SOL deposit are confirmed together." };
  });
}
