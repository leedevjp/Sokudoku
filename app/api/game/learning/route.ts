import { createClient } from "@/lib/supabase/server";
import { readIdentity } from "@/lib/supabase/read-identity";
import { synchronizeLearning } from "@/lib/game/learning/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const user = await readIdentity(client);
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
