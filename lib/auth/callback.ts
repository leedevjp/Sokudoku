import type { SupabaseClient } from "@supabase/supabase-js";

type CallbackAuth = Pick<SupabaseClient["auth"], "exchangeCodeForSession" | "getUser">;
type Outcome = {
  destination: string;
  diagnostic?: "missing_code" | "provider_error" | "missing_verifier" | "exchange_failed";
};

/** Verification and session creation are separate; never infer confirmation from a URL. */
export async function completeAuthCallback(
  params: URLSearchParams,
  auth: CallbackAuth,
): Promise<Outcome> {
  const code = params.get("code");
  if (code && !params.has("error")) {
    const flowId = params.get("sb_flow_id");
    const { error } = await auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) return { destination: "/" };

    // A reused link must not strand a user who already has a valid session.
    const { data } = await auth.getUser();
    if (data.user) return { destination: "/" };
    return {
      destination: "/auth/error?reason=session",
      diagnostic: error.code === "pkce_code_verifier_not_found"
        ? "missing_verifier" : "exchange_failed",
    };
  }

  const { data } = await auth.getUser();
  if (data.user) return { destination: "/" };
  return {
    destination: "/auth/error?reason=link",
    diagnostic: params.has("error") ? "provider_error" : "missing_code",
  };
}
