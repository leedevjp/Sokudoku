import { z } from "zod";
import { authorize, failure, privateHeaders, readInput } from "@/lib/personal/server";
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const { data, error } = await auth.client.rpc("treasure_inventory");
  return error ? failure("load_failed", 503) : Response.json(data, { headers: privateHeaders });
}
export async function POST(request: Request) {
  const auth = await authorize(request, true);
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await readInput(request); } catch { return failure("invalid_input", 400); }
  const input = z.object({ id: z.uuid() }).strict().safeParse(raw);
  if (!input.success) return failure("invalid_input", 400);
  const { data, error } = await auth.client.rpc("open_study_chest", { p_id: input.data.id });
  if (error) return failure(error.code === "22023" ? "open_in_order" : error.code === "P0002" ? "not_found" : "open_failed", error.code === "22023" ? 409 : error.code === "P0002" ? 404 : 503);
  return Response.json(data, { headers: privateHeaders });
}
