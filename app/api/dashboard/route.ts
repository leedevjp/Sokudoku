import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const timezone = new URL(request.url).searchParams.get("timezone") ?? "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    return Response.json(
      { error: "invalid_timezone" },
      { status: 400, headers },
    );
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const { data, error } = await client.rpc("learning_dashboard", {
    p_timezone: timezone,
  });
  if (error)
    return Response.json({ error: "load_failed" }, { status: 503, headers });
  return Response.json(data, { headers });
}
