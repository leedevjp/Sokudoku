import type { IDBPTransaction } from "idb";
import type { SyncDelta, SyncRow, SyncSnapshot } from "./types";

type LearningRow = { owner: string; key: string; ordinal: number; value: SyncRow };
type Transaction = IDBPTransaction<unknown, string[], "readwrite">;

/** Preserve insertion order: IndexedDB primary-key order changes seeded draws. */
export function learningMap(rows: LearningRow[]): Record<string, SyncRow> {
  return Object.fromEntries(rows.sort((a, b) => a.ordinal - b.ordinal).map(row => [row.key, row.value]));
}

export async function writeLearningRows(
  tx: Transaction, owner: string, snapshot: SyncSnapshot, previous: SyncSnapshot | undefined,
  delta: SyncDelta | undefined, writes: Promise<unknown>[],
): Promise<number> {
  const store = tx.objectStore("learning");
  let ordinal = previous?.nextLearningOrdinal ?? 0;
  if (!previous?.learningRows) {
    // Upgrade only this owner's canonical snapshot, inside its first successful
    // sync commit. The old blob remains readable until that transaction commits.
    for (const [key, value] of Object.entries(snapshot.data.learning_states))
      writes.push(store.put({ owner, key, value, ordinal: ordinal++ }));
    return ordinal;
  }
  let changes = delta?.changes.filter(change => change.dataset === "learning_states");
  if (!changes) {
    // Compatibility callers can supply a whole snapshot. Normal sync always
    // supplies its downloaded delta and never scans every persisted card.
    const rows: LearningRow[] = await store.index("owner").getAll(owner);
    const old = new Map(rows.map(row => [row.key, row]));
    changes = Object.entries(snapshot.data.learning_states).filter(([key, value]) =>
      JSON.stringify(old.get(key)?.value) !== JSON.stringify(value),
    ).map(([key, value]) => ({ dataset: "learning_states", key, value, deleted: false, version: "0" }));
    changes.push(...rows.filter(row => !snapshot.data.learning_states[row.key]).map(row =>
      ({ dataset: "learning_states" as const, key: row.key, value: null, deleted: true, version: "0" })));
  }
  // Coalescing repeated keys must retain delete/reinsert order, so process the
  // bounded changed-key requests in wire order, within this one transaction.
  for (const change of changes) {
    const key = [owner, change.key];
    if (change.deleted) { await store.delete(key); continue; }
    if (!change.value) continue;
    const old: LearningRow | undefined = await store.get(key);
    await store.put({ owner, key: change.key, value: change.value, ordinal: old?.ordinal ?? ordinal++ });
  }
  return ordinal;
}
