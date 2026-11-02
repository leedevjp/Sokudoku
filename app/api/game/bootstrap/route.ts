import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const since = new URL(request.url).searchParams.get("since");
  if (since && (since.length > 40 || !Number.isFinite(Date.parse(since))))
    return Response.json({ error: "invalid_cursor" }, { status: 400, headers });
  const { data, error } = await client.rpc("game_sync", { since: since ?? undefined });
  if (error)
    return Response.json({ error: "load_failed" }, { status: 503, headers });
  return Response.json({ user_id: user.id, ...(data as object) }, { headers });
}
