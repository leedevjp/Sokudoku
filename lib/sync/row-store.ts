import type { IDBPTransaction } from "idb";
import type { SyncDelta, SyncRow, SyncSnapshot } from "./types";

type StoredRow = { owner: string; key: string; ordinal: number; value: SyncRow };
type Transaction = IDBPTransaction<unknown, string[], "readwrite">;
export const rowLayouts = {
  learning_states: { store: "learning", ready: "learningRows", next: "nextLearningOrdinal" },
  answers: { store: "history", ready: "answerRows", next: "nextAnswerOrdinal" },
} as const;

/** Preserve insertion order: IndexedDB primary-key order changes seeded draws. */
export function orderedRowMap(rows: StoredRow[]): Record<string, SyncRow> {
  return Object.fromEntries(rows.sort((a, b) => a.ordinal - b.ordinal).map(row => [row.key, row.value]));
}

export async function writeSyncRows(
  tx: Transaction, owner: string, snapshot: SyncSnapshot, previous: SyncSnapshot | undefined,
  delta: SyncDelta | undefined, writes: Promise<unknown>[], dataset: keyof typeof rowLayouts = "learning_states",
): Promise<number> {
  const layout = rowLayouts[dataset], store = tx.objectStore(layout.store);
  let ordinal = previous?.[layout.next] ?? 0;
  if (!previous?.[layout.ready]) {
    // Upgrade only this owner's canonical snapshot, inside its first successful
    // sync commit. The old blob remains readable until that transaction commits.
    for (const [key, value] of Object.entries(snapshot.data[dataset])) {
      const write = store.put({ owner, key, value, ordinal: ordinal++ });
      void write.catch(() => {});
      writes.push(write);
    }
    return ordinal;
  }
  let changes = delta?.changes.filter(change => change.dataset === dataset);
  if (!changes) {
    // Compatibility callers can supply a whole snapshot. Normal sync always
    // supplies its downloaded delta and never scans every persisted row.
    const rows: StoredRow[] = await store.index("owner").getAll(owner);
    const old = new Map(rows.map(row => [row.key, row]));
    changes = Object.entries(snapshot.data[dataset]).filter(([key, value]) =>
      JSON.stringify(old.get(key)?.value) !== JSON.stringify(value),
    ).map(([key, value]) => ({ dataset, key, value, deleted: false, version: "0" }));
    changes.push(...rows.filter(row => !snapshot.data[dataset][row.key]).map(row =>
      ({ dataset, key: row.key, value: null, deleted: true, version: "0" })));
  }
  // Coalescing repeated keys must retain delete/reinsert order, so process the
  // bounded changed-key requests in wire order, within this one transaction.
  for (const change of changes) {
    const key = [owner, change.key];
    if (change.deleted) { await store.delete(key); continue; }
    if (!change.value) continue;
    const old: StoredRow | undefined = await store.get(key);
    await store.put({ owner, key: change.key, value: change.value, ordinal: old?.ordinal ?? ordinal++ });
  }
  return ordinal;
}
