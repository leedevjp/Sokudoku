import { openDB } from "idb";
import type { Answer, Word } from "./core";
const database = () =>
  openDB("sokudoku-game-v1", 1, {
    upgrade(db) {
      db.createObjectStore("answer", { keyPath: "id" });
      db.createObjectStore("cache");
    },
  });
type Queued = Answer & { owner: string };
export async function queueAnswer(owner: string, answer: Answer) {
  await (await database()).put("answer", { ...answer, owner });
}
export type WordCache = { words: Word[]; syncedAt: string };
export async function readWordCache(): Promise<WordCache | undefined> {
  return (await database()).get("cache", "word-sync-v1");
}
export async function readWords(): Promise<Word[] | undefined> {
  const db = await database();
  return (await db.get("cache", "word-sync-v1"))?.words ?? db.get("cache", "words");
}
export async function mergeWords(base: WordCache | undefined, changes: Word[], syncedAt: string): Promise<Word[]> {
  const words = new Map((base?.words ?? []).map((word) => [word.id, word]));
  for (const word of changes) {
    if (word.deleted_at) words.delete(word.id);
    else words.set(word.id, word);
  }
  const result = [...words.values()];
  try {
  const tx = (await database()).transaction("cache", "readwrite");
  // Keep the server timestamp verbatim, including microseconds.
  const current: WordCache | undefined = await tx.store.get("word-sync-v1");
  if (!current || current.syncedAt <= syncedAt) {
    await tx.store.put({ words: result, syncedAt }, "word-sync-v1");
    await tx.store.delete("words");
  }
  await tx.done;
  } catch {
    // Storage denial/quota errors must not prevent an online game. No cursor is advanced.
  }
  return result;
}
export async function pendingCount(owner: string) {
  return ((await (await database()).getAll("answer")) as Queued[]).filter(
    (a) => a.owner === owner,
  ).length;
}
let flight: Promise<void> | null = null;
export async function flushAnswers(owner: string): Promise<void> {
  if (flight) {
    await flight;
    return flushAnswers(owner);
  }
  flight = (async () => {
    const db = await database();
    const all = ((await db.getAll("answer")) as Queued[]).filter(
      (a) => a.owner === owner,
    );
    for (let i = 0; i < all.length; i += 200) {
      const batch = all.slice(i, i + 200);
      const response = await fetch("/api/game/answers", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          "X-Sokudoku-User": owner,
        },
        body: JSON.stringify(batch.map(({ owner: _, ...a }) => a)),
      });
      if (!response.ok) throw new Error("SYNC_FAILED");
      const data = await response.json();
      if (data.user_id !== owner) throw new Error("OWNER_CHANGED");
      if (
        !Array.isArray(data.ids) ||
        batch.some((a) => !data.ids.includes(a.id))
      )
        throw new Error("ACK_MISSING");
      const allowed = new Set(batch.map((a) => a.id));
      const tx = db.transaction("answer", "readwrite");
      for (const id of data.ids) {
        if (allowed.has(id)) tx.store.delete(id);
      }
      await tx.done;
    }
  })();
  try {
    await flight;
  } finally {
    flight = null;
  }
}
