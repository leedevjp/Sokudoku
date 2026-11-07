import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNUP_PENDING_KEY = "sokudoku-signup-pending-v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export type PendingSignup = { state: string; email: string; createdAt: number };
export type ConfirmationResult = "confirmed" | "signed-in" | "invalid" | "check-login" | "service";

export function signupRedirect(origin: string, email: string, storage: Storage | null, state: string, now = Date.now()) {
  try {
    storage?.setItem(SIGNUP_PENDING_KEY, JSON.stringify({ state, email: email.trim().toLowerCase(), createdAt: now }));
  } catch { /* Confirmation still works; login will be manual. */ }
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("signup", "1");
  url.searchParams.set("state", state);
  return url.toString();
}

export function pendingSignup(storage: Storage | null, state: string, now = Date.now()): PendingSignup | null {
  try {
    const value = JSON.parse(storage?.getItem(SIGNUP_PENDING_KEY) ?? "null") as PendingSignup | null;
    return value && value.state === state && typeof value.email === "string" &&
      Number.isFinite(value.createdAt) && value.createdAt <= now && now - value.createdAt <= 3600000
      ? value : null;
  } catch { return null; }
}

type VerifyAuth = Pick<SupabaseClient["auth"], "getUser">;
type SessionAuth = Pick<SupabaseClient["auth"], "getUser" | "setSession">;

/** Never infer successful confirmation from a query parameter or a decoded JWT. */
export async function confirmSignup(
  fragment: URLSearchParams,
  verifier: VerifyAuth,
  session: SessionAuth,
  pending: PendingSignup | null,
  legacy = false,
): Promise<ConfirmationResult> {
  if (fragment.has("error") || fragment.has("error_code")) return "invalid";
  const access_token = fragment.get("access_token");
  if (!access_token) {
    if (!legacy) return "invalid";
    const { data, error } = await session.getUser();
    return !error && data.user?.email_confirmed_at ? "confirmed" : "check-login";
  }
  if (fragment.get("type") !== "signup") return "invalid";
  let user;
  try {
    const { data, error } = await verifier.getUser(access_token);
    if (error || !data.user?.email_confirmed_at) return "invalid";
    user = data.user;
  } catch { return "service"; }
  // Authentication is optional. Its failure must never undo email confirmation.
  const refresh_token = fragment.get("refresh_token");
  if (pending && refresh_token && user.email?.toLowerCase() === pending.email) {
    try {
      const current = await session.getUser();
      // Do not replace a different account already logged in in this browser.
      if (current.data.user && current.data.user.id !== user.id) return "confirmed";
      const { error } = await session.setSession({ access_token, refresh_token });
      if (!error) return "signed-in";
    } catch { /* Keep the verified result and offer password login. */ }
  }
  return "confirmed";
}
