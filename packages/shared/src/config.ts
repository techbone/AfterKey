// Single source for cluster/program config — app code must never hardcode
// these (repo-blueprint.md §2).

export type Cluster = "localnet" | "devnet" | "mainnet-beta";

export const PROGRAM_ID = "DRJtSa5NS7FNdqko5xhbhQSPwLyYQoJA65cYfzWpRgc7";

export const RPC_URLS: Record<Cluster, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

// Mirror of programs/proof-of-life/src/constants.rs — keep in sync.
export const MAX_BENEFICIARIES = 10;
export const TOTAL_SHARE_BPS = 10_000;

export const SEEDS = {
  config: "config",
  vault: "vault",
  solEscrow: "sol_escrow",
} as const;
