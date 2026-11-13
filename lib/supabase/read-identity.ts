import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Verify the access token without a separate Auth user lookup on every read. */
export async function readIdentity(client: Pick<SupabaseClient<Database>, "auth">) {
  const { data, error } = await client.auth.getClaims();
  return !error && typeof data?.claims.sub === "string"
    ? { id: data.claims.sub }
    : null;
}
