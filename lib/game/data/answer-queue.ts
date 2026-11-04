import type { Answer } from "../types";
import { database, storageDeadline } from "./database";

type Queued = Answer & { owner: string };
export async function queueAnswer(owner: string, answer: Answer) {
  await storageDeadline((await database()).put("answer", { ...answer, owner }));
}
export async function pendingCount(owner: string) {
  return ((await (await database()).getAll("answer")) as Queued[]).filter(
    (a) => a.owner === owner,
  ).length;
}
export async function pendingAnswers(owner: string): Promise<Answer[]> {
  return ((await storageDeadline((await database()).getAll("answer"))) as Queued[])
    .filter((answer) => answer.owner === owner);
}
let flight: Promise<void> | null = null;
export async function flushAnswers(owner: string): Promise<void> {
  if (flight) {
    await flight;
    return flushAnswers(owner);
  }
  flight = (async () => {
    const db = await database();
    const all = (
      (await storageDeadline(db.getAll("answer"))) as Queued[]
    ).filter((a) => a.owner === owner);
    for (let i = 0; i < all.length; i += 200) {
      const batch = all.slice(i, i + 200);
      const response = await fetch("/api/game/answers", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          "X-Sokudoku-User": owner,
        },
        body: JSON.stringify(
          batch.map(({ owner, ...answer }) => {
            void owner;
            return answer;
          }),
        ),
      });
      if (!response.ok) throw new Error("SYNC_FAILED");
      const data = await response.json();
      if (data.user_id !== owner) throw new Error("OWNER_CHANGED");
      const acknowledged = [
        ...(Array.isArray(data.ids) ? data.ids : []),
        ...(Array.isArray(data.discarded_ids) ? data.discarded_ids : []),
      ];
      if (
        !Array.isArray(data.ids) ||
        batch.some((a) => !acknowledged.includes(a.id))
      )
        throw new Error("ACK_MISSING");
      const allowed = new Set(batch.map((a) => a.id));
      const tx = db.transaction("answer", "readwrite");
      for (const id of acknowledged) {
        if (allowed.has(id)) tx.store.delete(id);
      }
      await storageDeadline(tx.done);
    }
  })();
  try {
    await flight;
  } finally {
    flight = null;
  }
}
