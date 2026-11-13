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
  const { data, error } = await auth.client.rpc("personal_word_page", {
    p_query: input.data.q,
    p_page: input.data.page,
    p_stage: input.data.stage,
    p_sort: input.data.sort,
  });
  return error
    ? failure("load_failed", 503)
    : Response.json(data, { headers: privateHeaders });
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
