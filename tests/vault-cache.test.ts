import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/react-query";
import { refreshVaultQueries } from "../apps/web/src/lib/vault-cache.ts";

test("a confirmed receipt resolves even when the active history refetch is stalled", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const key = ["vault-history", "devnet", "test-program", "test-wallet"];
  client.setQueryData(key, ["retained-record"]);
  let release!: (value: string[]) => void;
  const read = new Promise<string[]>(resolve => { release = resolve; });
  const query = new QueryObserver(client, { queryKey: key, queryFn: () => read });
  const unsubscribe = query.subscribe(() => {});
  const mutation = new MutationObserver(client, {
    mutationFn: async () => ({ signature: "confirmed-test-signature" }),
    onSettled: () => refreshVaultQueries(client)
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const receipt = await Promise.race([
      mutation.mutate(undefined),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Receipt blocked on follow-up RPC")), 1000); })
    ]);
    assert.equal(receipt.signature, "confirmed-test-signature");
    assert.equal(mutation.getCurrentResult().status, "success");
    assert.equal(query.getCurrentResult().fetchStatus, "fetching");
  } finally {
    if (timeout) clearTimeout(timeout);
    release(["updated-record"]);
    await client.refetchQueries({ queryKey: key });
    unsubscribe();
    client.clear();
  }
});
