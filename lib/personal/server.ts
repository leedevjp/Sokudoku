import { createClient } from "@/lib/supabase/server";
export { readInput } from "./input";
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
    (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
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
