import { PublicKey } from "@solana/web3.js";

function decimalUnits(value: string, decimals: number, label: string): bigint {
  const trimmed = value.trim();
  const pattern = new RegExp(`^(?:\\d+(?:\\.\\d{0,${decimals}})?|\\.\\d{1,${decimals}})$`);
  if (!pattern.test(trimmed)) {
    throw new Error(`${label} must be a positive decimal with at most ${decimals} decimal places.`);
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals)
    + BigInt(fraction.padEnd(decimals, "0"));
}

/** Parse decimal SOL without floating-point rounding or silent truncation. */
export function solToLamports(value: string, allowZero = false): bigint {
  const amount = decimalUnits(value, 9, "SOL amount");
  if ((!allowZero && amount === 0n) || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(amount === 0n ? "Enter an amount greater than zero." : "This SOL amount is too large.");
  }
  return amount;
}

export function percentToBps(value: string): number {
  const bps = decimalUnits(value, 2, "Each share");
  if (bps === 0n || bps > 10_000n) throw new Error("Each share must be greater than 0% and at most 100%.");
  return Number(bps);
}

export function validateEscrowBalance(balance: bigint, minimum: bigint) {
  if (balance > 0n && balance < minimum) {
    throw new Error("This would leave too little SOL for vault rent. Increase the deposit, or withdraw the full SOL balance.");
  }
}

export function validateBeneficiaries(
  rows: { address: string; percent: string }[],
  owner: PublicKey,
) {
  if (rows.length === 0 || rows.length > 10) throw new Error("Choose between 1 and 10 beneficiaries.");
  const seen = new Set<string>();
  const beneficiaries = rows.map((row, index) => {
    let key: PublicKey;
    try {
      key = new PublicKey(row.address.trim());
      if (key.equals(PublicKey.default) || !PublicKey.isOnCurve(key.toBytes())) throw new Error("not a wallet");
    } catch {
      throw new Error(`Beneficiary ${index + 1} needs a valid wallet address that can sign a claim.`);
    }
    if (key.equals(owner)) throw new Error("You can't be your own beneficiary.");
    const address = key.toBase58();
    if (seen.has(address)) throw new Error("Each beneficiary must have a different wallet address.");
    seen.add(address);
    return { key, shareBps: percentToBps(row.percent) };
  });
  if (beneficiaries.reduce((sum, b) => sum + b.shareBps, 0) !== 10_000) {
    throw new Error("Shares must add up to exactly 100%.");
  }
  return beneficiaries;
}

export function transactionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|declin|cancelled|canceled/i.test(message)) return "Signature declined. This action was not submitted. You can try again.";
  if (/blockhash|expired|timeout|timed out|not confirmed/i.test(message)) {
    return "Confirmation is taking longer than expected. Refresh the vault and check your wallet history before trying again.";
  }
  if (/InactivityPeriodNotElapsed|ChallengeNotElapsed/.test(message)) return "The on-chain waiting period hasn't ended yet. Wait a few seconds and refresh.";
  if (/insufficient|0x1\b/i.test(message)) return "Not enough SOL for this amount, account rent, and transaction fees. Check your devnet wallet balance.";
  if (/Paused/.test(message)) return "New vaults and deposits are temporarily paused. Check-ins, withdrawals, and claims remain available.";
  if (/WrongState/.test(message)) return "This vault changed since the page loaded. Refresh it before trying again.";
  if (/fetch|network|429|403|503|rpc/i.test(message)) return "We couldn't reach Solana. Your on-chain vault is unchanged by this read failure. Refresh and try again.";
  return message.length <= 180 ? message : "The transaction couldn't be completed. Refresh the vault and check your wallet history before retrying.";
}
