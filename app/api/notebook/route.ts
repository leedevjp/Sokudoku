import { readIdentity } from "@/lib/supabase/read-identity";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const user = await readIdentity(client);
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const { data, error } = await client.rpc("notebook_page");
  if (error)
    return Response.json({ error: "load_failed" }, { status: 503, headers });
  return Response.json(data, { headers });
}
