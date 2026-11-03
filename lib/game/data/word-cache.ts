import type { Word } from "../types";
import { database, storageDeadline } from "./database";

export type WordCache = { words: Word[]; syncedAt: string };
export async function readWordCache(
  key = "word-sync-v1",
): Promise<WordCache | undefined> {
  return storageDeadline((await database()).get("cache", key));
}
export async function readWords(): Promise<Word[] | undefined> {
  const db = await database();
  return (
    (await storageDeadline(db.get("cache", "word-sync-v1")))?.words ??
    storageDeadline(db.get("cache", "words"))
  );
}
export async function mergeWords(
  base: WordCache | undefined,
  changes: Word[],
  syncedAt: string,
  key = "word-sync-v1",
): Promise<Word[]> {
  const words = new Map((base?.words ?? []).map((word) => [word.id, word]));
  for (const word of changes) {
    if (word.deleted_at) words.delete(word.id);
    else words.set(word.id, word);
  }
  const result = [...words.values()];
  try {
    const tx = (await database()).transaction("cache", "readwrite");
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {
        /* Already completed. */
      }
    }, 3000);
    // Observe transaction failure even if an earlier request rejects first.
    void tx.done.catch(() => {});
    try {
      // Keep the server timestamp verbatim, including microseconds.
      const current: WordCache | undefined = await tx.store.get(key);
      if (!current || current.syncedAt <= syncedAt) {
        await tx.store.put({ words: result, syncedAt }, key);
        if (key === "word-sync-v1") await tx.store.delete("words");
      }
      await tx.done;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Storage denial/quota errors must not prevent an online game. No cursor is advanced.
  }
  return result;
}
