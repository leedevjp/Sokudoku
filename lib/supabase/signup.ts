import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Email confirmation must work without the signing-up browser's PKCE cookie.
 * This client never persists the confirmation session or automatically reads URLs.
 * Password login and the rest of the app still use the normal SSR cookie client.
 */
export function createSignupClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Error("Supabase configuration is missing.");
  return createSupabaseClient<Database>(url, key, {
    auth: {
      flowType: "implicit", persistSession: false, autoRefreshToken: false,
      detectSessionInUrl: false, storageKey: "sokudoku-signup-verification",
    },
  });
}
