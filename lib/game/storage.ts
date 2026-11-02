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
export async function saveWords(words: Word[]) {
  await (await database()).put("cache", words, "words");
}
export async function readWords(): Promise<Word[] | undefined> {
  return (await database()).get("cache", "words");
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
