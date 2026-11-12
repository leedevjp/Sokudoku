import { personalSearchFilter, stageDifficulties } from "@/lib/personal/filters";
import { z } from "zod";
import {
  authorize,
  failure,
  privateHeaders,
  readInput,
} from "@/lib/personal/server";
import {
  listInput,
  personalWordInput,
  wordChanges,
} from "@/lib/personal/schema";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = listInput.safeParse({
    q: params.get("q") ?? "",
    stage: params.get("stage") ?? "all",
    sort: params.get("sort") ?? "recent",
    page: params.get("page") ?? 1,
  });
  if (!input.success) return failure("invalid_input", 400);
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const { q, stage, sort } = input.data;
  const base = () => auth.client.from("personal_word").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).is("deleted_at", null);
  const filter = <T extends { in: (column: string, values: number[]) => T; or: (filter: string) => T }>(query: T): T => {
    const difficulties = stageDifficulties(stage);
    if (difficulties) query = query.in("difficulty", difficulties);
    if (q) query = query.or(personalSearchFilter(q));
    return query;
  };
  const [all, matches] = await Promise.all([base(), filter(base())]);
  if (all.error || matches.error) return failure("load_failed", 503);
  const total = matches.count ?? 0;
  const page = Math.min(input.data.page, Math.max(1, Math.ceil(total / 20)));
  let query = filter(auth.client.from("personal_word").select("id,term,kana,pronunciation_ko,hanja_reading,meaning_ko,has_kanji,difficulty,note,entry_type,created_at,updated_at,deleted_at").eq("user_id", auth.user.id).is("deleted_at", null));
  if (sort === "reading") query = query.order("kana", { ascending: true });
  else if (sort === "easy" || sort === "hard") query = query.order("difficulty", { ascending: sort === "easy" });
  query = query.order("created_at", { ascending: sort === "oldest" }).order("id", { ascending: sort === "oldest" });
  const { data, error } = await query.range((page - 1) * 20, page * 20 - 1);
  return error ? failure("load_failed", 503) : Response.json({ words: data, total, all_total: all.count ?? 0, page, page_size: 20 }, { headers: privateHeaders });
}
export async function POST(request: Request) {
  const auth = await authorize(request, true);
  if (auth.response) return auth.response;
  let raw: unknown;
  try {
    raw = await readInput(request);
  } catch {
    return failure("invalid_input", 400);
  }
  const input = personalWordInput.safeParse(raw);
  if (!input.success)
    return failure(
      "invalid_input",
      400,
      z.flattenError(input.error).fieldErrors,
    );
  const { data, error } = await auth.client
    .from("personal_word")
    .insert({
      ...wordChanges(input.data),
      user_id: auth.user.id,
      entry_type: "word",
    })
    .select("id")
    .single();
  if (error)
    return failure(
      error.code === "23505" ? "duplicate" : "save_failed",
      error.code === "23505" ? 409 : 503,
    );
  return Response.json(
    { id: data.id },
    { status: 201, headers: privateHeaders },
  );
}
