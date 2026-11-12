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
  if (!data?.length) return Response.json({ words: [] }, { headers });
  const commonIds = data.filter(w => w.source === "word").map(w => w.id);
  const [personalResult, commonResult] = await Promise.all([
    client.from("personal_word")
    .select("id,term,kana,updated_at").in("term", [...new Set((data ?? []).map(w => w.term))]).eq("user_id", user.id).is("deleted_at", null),
    commonIds.length ? client.from("word").select("id,entry_type").in("id", commonIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: personal, error: personalError } = personalResult;
  if (personalError || commonResult.error) return Response.json({ error: "load_failed" }, { status: 503, headers });
  const matches = new Map(personal.map(w => [JSON.stringify([w.term, w.kana]), w]));
  const entryTypes = new Map(commonResult.data?.map(w => [w.id, w.entry_type]));
  const words = (data ?? []).map(w => ({ ...w,
    entry_type: w.source === "word" ? entryTypes.get(w.id) ?? "word" : "word",
    in_personal: w.source === "personal" || matches.has(JSON.stringify([w.term, w.kana])),
    personal_entry: matches.get(JSON.stringify([w.term, w.kana])) ?? null,
    can_add_personal: w.source === "word" && w.difficulty >= 0,
  }));
  return Response.json({ words }, { headers });
}
