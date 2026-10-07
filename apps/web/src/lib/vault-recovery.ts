import { PublicKey } from "@solana/web3.js";

export interface RecoveryRecord { owner: PublicKey; claimer: PublicKey }
export interface RecoveryBeneficiary { key: PublicKey; shareBps: number }

export function recoveryPolicy(record: RecoveryRecord, signer: PublicKey) {
  const cancelled = record.claimer.equals(PublicKey.default);
  return { kind: cancelled ? "cancelled" as const : "inherited" as const,
    canAct: !cancelled || record.owner.equals(signer), action: cancelled ? "withdraw" as const : "distribute" as const };
}

/** Use the same integer allocation and last-recipient remainder as the program. */
export function recoveryAllocations(balance: bigint, beneficiaries: readonly RecoveryBeneficiary[]) {
  if (balance < 0n || beneficiaries.length === 0 || beneficiaries.length > 10
      || beneficiaries.some(b => !Number.isInteger(b.shareBps) || b.shareBps <= 0)
      || beneficiaries.reduce((sum, b) => sum + b.shareBps, 0) !== 10_000) throw new Error("The saved beneficiary allocation is invalid. Refresh this record before signing.");
  let paid = 0n;
  return beneficiaries.map((beneficiary, index) => {
    const lamports = index === beneficiaries.length - 1 ? balance - paid : balance * BigInt(beneficiary.shareBps) / 10_000n;
    paid += lamports;
    return { ...beneficiary, lamports };
  });
}

export function formatSolLamports(lamports: bigint) {
  if (lamports < 0n) throw new Error("A SOL balance cannot be negative.");
  const whole = (lamports / 1_000_000_000n).toLocaleString("en-US");
  const fraction = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
