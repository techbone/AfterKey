import { join } from "node:path";

/** Supabase's trust path is resolved on this host, including inside a container. */
export function databaseUrl(value: string): string {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("A PostgreSQL connection URI is required.");
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".pooler.supabase.com")) {
    url.searchParams.delete("ssl"); url.searchParams.delete("uselibpqcompat");
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.set("sslrootcert", join(import.meta.dirname, "../certs/supabase-prod-ca-2021.crt"));
  }
  return url.toString();
}
