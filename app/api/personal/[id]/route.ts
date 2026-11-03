import { z } from "zod";
import {
  authorize,
  failure,
  privateHeaders,
  readInput,
} from "@/lib/personal/server";
import {
  personalWordUpdate,
  revisionInput,
  wordChanges,
} from "@/lib/personal/schema";
type Context = { params: Promise<{ id: string }> };
async function mutate(request: Request, context: Context, remove: boolean) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return failure("invalid_input", 400);
  const auth = await authorize(request, true);
  if (auth.response) return auth.response;
  let raw: unknown;
  try {
    raw = await readInput(request);
  } catch {
    return failure("invalid_input", 400);
  }
  const revision = revisionInput.safeParse(raw);
  const edit = personalWordUpdate.safeParse(raw);
  if (remove ? !revision.success : !edit.success) {
    const error = remove ? revision.error : edit.error;
    return failure(
      "invalid_input",
      400,
      error ? z.flattenError(error).fieldErrors : undefined,
    );
  }
  const updated_at = remove ? revision.data!.updated_at : edit.data!.updated_at;
  // IDs and learning state remain unchanged. Only content or the deletion marker is updated.
  const changes = remove
    ? { deleted_at: new Date().toISOString() }
    : (() => {
        const { updated_at: revision, ...input } = edit.data!;
        void revision;
        return wordChanges(input);
      })();
  const { data, error } = await auth.client
    .from("personal_word")
    .update(changes)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .eq("updated_at", updated_at)
    .select("id")
    .maybeSingle();
  if (error)
    return failure(
      error.code === "23505" ? "duplicate" : "save_failed",
      error.code === "23505" ? 409 : 503,
    );
  if (!data) {
    const { data: existing, error: checkError } = await auth.client
      .from("personal_word")
      .select("id")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (checkError) return failure("save_failed", 503);
    return failure(existing ? "stale" : "not_found", existing ? 409 : 404);
  }
  return Response.json({ id: data.id }, { headers: privateHeaders });
}
export async function PATCH(request: Request, context: Context) {
  return mutate(request, context, false);
}
export async function DELETE(request: Request, context: Context) {
  return mutate(request, context, true);
}
