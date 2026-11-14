import { z } from "zod";
import { after } from "next/server";
import { answerSchema } from "@/lib/game/answer-schema";
import { createClient } from "@/lib/supabase/server";
import { synchronizeLearning } from "@/lib/game/learning/server";
import {
  personalReferences,
  partitionAnswers,
} from "@/lib/game/answer-references";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (request.headers.get("X-Sokudoku-User") !== user.id)
    return Response.json({ error: "owner_changed" }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 200000)
    return Response.json({ error: "too_large" }, { status: 413, headers });
  const body = await request.text();
  if (body.length > 200000)
    return Response.json({ error: "too_large" }, { status: 413, headers });
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers });
  }
  const parsed = z.array(answerSchema).min(1).max(200).safeParse(input);
  if (!parsed.success)
    return Response.json({ error: "invalid_batch" }, { status: 400, headers });
  let accepted = parsed.data;
  let discarded: typeof accepted = [];
  let saved = false;
  // Recheck on FK races if another tab deletes a personal word during upload.
  for (let attempt = 0; attempt < 3; attempt++) {
    const refs = personalReferences(parsed.data);
    const available = new Set<string>();
    if (refs.length) {
      const { data, error } = await client
        .from("personal_word")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("id", refs);
      if (error)
        return Response.json(
          { error: "reference_check_failed" },
          { status: 503, headers },
        );
      for (const row of data) available.add(row.id);
    }
    ({ accepted, discarded } = partitionAnswers(parsed.data, available));
    if (!accepted.length) {
      saved = true;
      break;
    }
    const rows = accepted.map(({ source, selected_source, ...a }) => ({
      ...a,
      user_id: user.id,
      word_id: source === "personal" ? null : a.word_id,
      personal_word_id: source === "personal" ? a.word_id : null,
      selected_word_id:
        selected_source === "personal" || selected_source === "extra" ? null : a.selected_word_id,
      selected_personal_word_id:
        selected_source === "personal" ? a.selected_word_id : null,
      selected_extra_meaning_choice_id:
        selected_source === "extra" ? a.selected_word_id : null,
    }));
    const { error } = await client
      .from("answer_log")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (!error) {
      saved = true;
      break;
    }
    if (error.code !== "23503")
      return Response.json({ error: "save_failed" }, { status: 400, headers });
  }
  if (!saved)
    return Response.json({ error: "save_failed" }, { status: 503, headers });
  // A conflicting UUID owned by somebody else must never acknowledge this user's queue.
  const { data: stored, error: checkError } = accepted.length
    ? await client
        .from("answer_log")
        .select("id")
        .in(
          "id",
          accepted.map((a) => a.id),
        )
    : { data: [], error: null };
  if (checkError)
    return Response.json({ error: "verify_failed" }, { status: 503, headers });
  // The answer log is durable before acknowledgement. Derived FSRS state must
  // not hold the save response; the next learning read also repairs pending work.
  if (stored.length) after(async () => {
    try { await synchronizeLearning(client); }
    catch (error) { console.error("Deferred learning synchronization failed", error); }
  });
  return Response.json(
    {
      user_id: user.id,
      ids: stored.map((a) => a.id),
      discarded_ids: discarded.map((a) => a.id),
    },
    { headers },
  );
}
