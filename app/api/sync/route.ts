import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readIdentity } from "@/lib/supabase/read-identity";
import { synchronizeLearning } from "@/lib/game/learning/server";
import { datasets } from "@/lib/sync/types";

const headers = { "Cache-Control": "private, no-store" };
const versions = z.partialRecord(z.enum(datasets), z.string().regex(/^\d{1,18}$/));
const input = z.object({ versions, dataset: z.enum(datasets).default("words"), through: versions.nullable().optional(),
  after: z.tuple([z.string().regex(/^\d{1,18}$/), z.string().max(250)]).nullable().optional() }).strict();
export async function GET() {
  const client = await createClient();
  if (!await readIdentity(client)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const { data, error } = await client.rpc("sync_manifest");
  return error ? Response.json({ error: "sync_failed" }, { status: 503, headers }) : Response.json(data, { headers });
}
export async function POST(request: Request) {
  const client = await createClient();
  if (!await readIdentity(client)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  const body = await request.text();
  if (body.length > 4096) return Response.json({ error: "invalid_input" }, { status: 400, headers });
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
  const parsed = input.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400, headers });
  try {
    const { data: manifest, error } = await client.rpc("sync_manifest");
    if (error) throw error;
    const latest = manifest as { versions: Record<string, string> };
    if (!parsed.data.through && (parsed.data.versions.answers ?? "0") !== (latest.versions.answers ?? "0"))
      await synchronizeLearning(client);
    const result = await client.rpc("sync_pull", { p_versions: { ...parsed.data.versions,
      $dataset: parsed.data.dataset, ...(parsed.data.through ? { $through: parsed.data.through } : {}),
      ...(parsed.data.after ? { $after: parsed.data.after } : {}) } });
    if (result.error) throw result.error;
    return Response.json(result.data, { headers });
  } catch { return Response.json({ error: "sync_failed" }, { status: 503, headers }); }
}
