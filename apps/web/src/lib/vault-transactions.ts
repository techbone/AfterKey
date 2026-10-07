import BN from "bn.js";
import { type IdlAccounts, type Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { ProofOfLife } from "../../../../packages/program/proof_of_life.ts";
import { recoveryAllocations, recoveryPolicy } from "./vault-recovery";

type VaultProgram = Program<ProofOfLife>;

export function vaultAddresses(programId: PublicKey, owner: PublicKey, vaultId: BN) {
  const seed = (s: string) => new TextEncoder().encode(s);
  const [vault] = PublicKey.findProgramAddressSync(
    [seed("vault"), owner.toBytes(), Uint8Array.from(vaultId.toArray("le", 8))], programId,
  );
  const [solEscrow] = PublicKey.findProgramAddressSync([seed("sol_escrow"), vault.toBytes()], programId);
  const [config] = PublicKey.findProgramAddressSync([seed("config")], programId);
  return { vault, solEscrow, config };
}

export async function createVaultTransaction(
  program: VaultProgram,
  owner: PublicKey,
  vaultId: BN,
  inactivitySecs: number,
  challengeSecs: number,
  beneficiaries: { key: PublicKey; shareBps: number }[],
  depositLamports: bigint,
) {
  const addresses = vaultAddresses(program.programId, owner, vaultId);
  const tx = await program.methods
    .initializeVault(vaultId, new BN(inactivitySecs), new BN(challengeSecs), beneficiaries)
    .accountsPartial({ owner, ...addresses, systemProgram: SystemProgram.programId })
    .transaction();
  if (depositLamports > 0n) {
    tx.add(await program.methods.depositSol(new BN(depositLamports.toString()))
      .accountsPartial({ owner, ...addresses, systemProgram: SystemProgram.programId }).instruction());
  }
  return { transaction: tx, vault: addresses.vault };
}

/** All instructions share a single signature and commit together or roll back. */
export async function cancelVaultTransaction(
  program: VaultProgram, owner: PublicKey, vault: PublicKey, balance: bigint, inChallenge: boolean,
) {
  const tx = new Transaction();
  if (inChallenge) tx.add(await program.methods.vetoClaim().accountsPartial({ owner, vault }).instruction());
  if (balance > 0n) tx.add(await program.methods.withdrawSol(new BN(balance.toString())).accountsPartial({ owner, vault }).instruction());
  tx.add(await program.methods.closeVault().accountsPartial({ owner, vault }).instruction());
  return tx;
}

export async function receiveInheritanceTransaction(
  program: VaultProgram, cranker: PublicKey, vault: PublicKey,
  beneficiaries: { key: PublicKey; shareBps: number }[], balance: bigint,
  finalize = false,
) {
  const tx = new Transaction();
  if (finalize) tx.add(await program.methods.finalizeClaim().accounts({ cranker, vault }).instruction());
  if (balance > 0n) {
    tx.add(await program.methods.distributeSol().accounts({ cranker, vault })
      .remainingAccounts(beneficiaries.map(b => ({ pubkey: b.key, isSigner: false, isWritable: true })))
      .instruction());
  }
  tx.add(await program.methods.closeReleasedVault().accounts({ cranker, vault }).instruction());
  return tx;
}

/** A retained Closed record is recovered without finalizing or closing again. */
export async function recoverClosedVaultTransaction(program: VaultProgram, signer: PublicKey, vault: PublicKey,
  account: IdlAccounts<ProofOfLife>["vault"], balance: bigint) {
  if (!("closed" in account.state)) throw new Error("This plan is not closed. Use its active vault actions instead.");
  if (balance <= 0n) throw new Error("No SOL is waiting to be recovered. Refresh this record.");
  const policy = recoveryPolicy(account, signer);
  if (!policy.canAct) throw new Error("Only the vault owner can recover its SOL.");
  if (policy.action === "withdraw") {
    return program.methods.withdrawSol(new BN(balance.toString())).accountsPartial({ owner: signer, vault }).transaction();
  }
  recoveryAllocations(balance, account.beneficiaries);
  return program.methods.distributeSol().accountsPartial({ cranker: signer, vault })
    .remainingAccounts(account.beneficiaries.map(b => ({ pubkey: b.key, isSigner: false, isWritable: true }))).transaction();
}
