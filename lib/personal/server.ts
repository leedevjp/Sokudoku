import { createClient } from "@/lib/supabase/server";
export const privateHeaders = { "Cache-Control": "private, no-store" };
export function failure(
  error: string,
  status: number,
  fields?: Record<string, string[]>,
) {
  return Response.json(
    { error, ...(fields ? { fields } : {}) },
    { status, headers: privateHeaders },
  );
}
export async function authorize(request: Request, write = false) {
  if (
    write &&
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  ) {
    return { response: failure("forbidden", 403) } as const;
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { response: failure("unauthorized", 401) } as const;
  return { client, user } as const;
}
export async function readInput(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 32000)
    throw Error("too_large");
  const text = await request.text();
  if (text.length > 16000) throw Error("too_large");
  return JSON.parse(text) as unknown;
}
