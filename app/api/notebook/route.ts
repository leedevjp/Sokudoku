import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const { data, error } = await client.rpc("recent_mistake_word");
  if (error)
    return Response.json({ error: "load_failed" }, { status: 503, headers });
  return Response.json({ words: data ?? [] }, { headers });
}
