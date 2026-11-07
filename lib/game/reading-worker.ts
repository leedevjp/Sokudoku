import { addReading, emptyReadingIndex, normalizedReading, readingSignature, READING_INDEX_VERSION, searchReadings, type ReadingIndex } from "./reading-index";
import { database, storageDeadline } from "./data/database";

export type ReadingRequest = { id: number } & (
  { type: "init"; owner: string; common: string[]; personal: string[] } |
  { type: "search"; kana: string }
);
export type ReadingReply = { id: number; readings?: string[]; error?: string; reused?: boolean[] };
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<ReadingRequest>) => void) | null; postMessage: (reply: ReadingReply) => void };
let indexes: ReadingIndex[] = [];
const results = new Map<string, string[]>();
async function loadIndex(key: string, readings: string[]) {
  const signature = readingSignature(readings);
  const cached = await database().then((db) => storageDeadline(db.get("cache", key))).catch(() => undefined) as { signature: string; index: ReadingIndex } | undefined;
  if (cached?.signature === signature && cached.index?.version === READING_INDEX_VERSION)
    return { index: cached.index, reused: true };
  const index = emptyReadingIndex();
  for (const reading of JSON.parse(signature) as string[]) addReading(index, reading);
  // Optional persistence must not delay the ready response or break online play.
  void database().then((db) => storageDeadline(db.put("cache", { signature, index }, key))).catch(() => {});
  return { index, reused: false };
}
let chain = Promise.resolve();
scope.onmessage = ({ data: request }) => {
  chain = chain.then(async () => {
    try {
      if (request.type === "init") {
        const loaded = await Promise.all([
          loadIndex("reading-index-v1:common", request.common),
          loadIndex("reading-index-v1:personal:" + request.owner, request.personal),
        ]);
        indexes = loaded.map((x) => x.index);
        results.clear();
        scope.postMessage({ id: request.id, reused: loaded.map((x) => x.reused) });
      } else {
        const key = normalizedReading(request.kana);
        let readings = results.get(key);
        if (!readings) { readings = searchReadings(indexes, key); results.set(key, readings); }
        scope.postMessage({ id: request.id, readings });
      }
    } catch { scope.postMessage({ id: request.id, error: "READING_INDEX" }); }
  });
};
