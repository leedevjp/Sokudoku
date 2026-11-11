import { NextResponse } from "next/server";

// This endpoint is served by the currently active Vercel deployment.
// Never cache a response, or an old deployment can appear current.
export function GET() {
  const response = NextResponse.json({
    id: process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_ID ?? "development",
    builtAt: process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_TIME ?? null,
    commit: process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_COMMIT ?? null,
  });
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}
