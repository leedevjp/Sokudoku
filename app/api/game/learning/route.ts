import { createClient } from "@/lib/supabase/server";
import { synchronizeLearning } from "@/lib/game/learning/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    return Response.json(
      { user_id: user.id, learning: await synchronizeLearning(client) },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "learning_failed" },
      { status: 503, headers },
    );
  }
}
