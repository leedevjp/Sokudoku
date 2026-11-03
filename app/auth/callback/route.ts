import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeAuthCallback } from "@/lib/auth/callback";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let destination = "/auth/error?reason=service";
  try {
    const client = await createClient();
    const outcome = await completeAuthCallback(params, client.auth);
    destination = outcome.destination;
    if (outcome.diagnostic) {
      // Never log the URL, auth code, tokens or email.
      console.warn("Auth callback incomplete", { reason: outcome.diagnostic });
    }
  } catch {
    console.warn("Auth callback incomplete", { reason: "service_error" });
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
