interface VaultQueryCache {
  invalidateQueries(filters: { queryKey: string[] }): Promise<unknown>;
}

/** Confirmed receipts must not wait for slow or failing follow-up RPC reads. */
export function refreshVaultQueries(client: VaultQueryCache) {
  for (const key of ["vaults", "vault-balance", "vault-balance-lamports", "claimable", "vault-history"]) {
    void client.invalidateQueries({ queryKey: [key] }).catch(() => {
      // Query observers show their own RPC error/retry state.
    });
  }
}
