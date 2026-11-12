import { personalCopy } from "@/lib/notebook/personal-copy";
import { z } from "zod";
import { authorize, failure, privateHeaders, readInput } from "@/lib/personal/server";

const input = z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict();
export async function POST(request: Request) {
  const auth = await authorize(request, true);
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await readInput(request); } catch { return failure("invalid_input", 400); }
  const parsed = input.safeParse(raw);
  if (!parsed.success) return failure("invalid_input", 400);
  const ids = [...new Set(parsed.data.ids)];
  const { data, error } = await auth.client.from("word").select("*").in("id", ids).is("deleted_at", null);
  if (error) return failure("load_failed", 503);
  const results: { id: string; status: "added" | "exists" | "failed" | "unavailable" }[] = [];
  for (const id of ids) {
    const word = data.find(w => w.id === id);
    if (!word || word.entry_type !== "word" || word.difficulty < 0) {
      results.push({ id, status: "unavailable" }); continue;
    }
    // Read the current database row, never vocabulary supplied by the browser.
    const { error: saveError } = await auth.client.from("personal_word").insert(personalCopy(word, auth.user.id));
    results.push({ id, status: !saveError ? "added" : saveError.code === "23505" ? "exists" : "failed" });
  }
  return Response.json({ results }, { headers: privateHeaders });
}
