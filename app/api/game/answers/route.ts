import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const answer = z
  .object({
    id: z.uuid(),
    word_id: z.uuid(),
    question_type: z.enum(["meaning", "reading"]),
    selected_word_id: z.uuid().nullable(),
    result: z.enum(["correct", "incorrect", "timeout"]),
    response_ms: z.number().int().min(0).max(10000),
    time_limit_ms: z.number().int().min(2000).max(10000),
    answered_at: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((a) =>
    a.result === "timeout"
      ? a.selected_word_id === null && a.response_ms === a.time_limit_ms
      : a.selected_word_id !== null &&
        a.response_ms < a.time_limit_ms &&
        (a.result === "correct"
          ? a.selected_word_id === a.word_id
          : a.selected_word_id !== a.word_id),
  );
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
  const parsed = z.array(answer).min(1).max(200).safeParse(input);
  if (!parsed.success)
    return Response.json({ error: "invalid_batch" }, { status: 400, headers });
  const rows = parsed.data.map((a) => ({ ...a, user_id: user.id }));
  const { error } = await client
    .from("answer_log")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error)
    return Response.json({ error: "save_failed" }, { status: 400, headers });
  // A conflicting UUID owned by somebody else must never acknowledge this user's queue.
  const { data: stored, error: checkError } = await client
    .from("answer_log")
    .select("id")
    .in(
      "id",
      rows.map((a) => a.id),
    );
  if (checkError)
    return Response.json({ error: "verify_failed" }, { status: 503, headers });
  return Response.json(
    { user_id: user.id, ids: stored.map((a) => a.id) },
    { headers },
  );
}
