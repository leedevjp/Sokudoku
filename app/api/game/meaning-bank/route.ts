import { createClient } from "@/lib/supabase/server";
import { MEANING_BANK_VERSION } from "@/lib/game/meaning-bank";
import { parseLevels, selectedDifficulty } from "@/lib/game/selection";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const levels = new URL(request.url).searchParams.get("levels");
  if (!levels || !/^[1-5](,[1-5]){0,4}$/.test(levels))
    return Response.json({ error: "invalid_levels" }, { status: 400, headers });
  const difficulties = [...selectedDifficulty(parseLevels(levels))];
  const { data, error } = await client.rpc("game_meaning_bank", { difficulties });
  if (error) return Response.json({ error: "load_failed" }, { status: 503, headers });
  return Response.json({ version: MEANING_BANK_VERSION, bank: data }, { headers });
}
