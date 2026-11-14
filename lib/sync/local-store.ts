import { database, storageDeadline } from "../game/data/database";
import { datasets, snapshotKey, type QueuedAnswer, type SyncSnapshot } from "./types";

export const syncDataKey = (owner: string, dataset: string) =>
  `sync-data-v1:${owner}:${dataset}`;

export type PlayableSyncState = {
  snapshot?: SyncSnapshot;
  pending: QueuedAnswer[];
};

/** Read a single playable snapshot of the canonical state and local outbox.
 *
 * The worker commits server state and acknowledged-answer deletion in one
 * readwrite transaction. This read transaction sees the state before OR
 * after that commit, never an old snapshot paired with an already-empty queue.
 * The same code is used for normal worker preparation and offline fallback.
 */
export async function readLocalSync(
  owner: string,
  cached?: SyncSnapshot,
  includePending = false,
): Promise<PlayableSyncState> {
  const tx = (await database()).transaction(["cache", "answer"], "readonly");
  const cache = tx.objectStore("cache");
  void tx.done.catch(() => {});
  const [meta, pendingRows]: [SyncSnapshot | undefined, QueuedAnswer[]] = await Promise.all([
    cache.get(snapshotKey(owner)),
    includePending ? tx.objectStore("answer").getAll() : Promise.resolve([]),
  ]);
  const data = meta?.data ?? {} as SyncSnapshot["data"];
  if (meta) {
    if (meta.owner !== owner) throw Error("OWNER_CHANGED");
    await Promise.all(datasets.map(async dataset => {
      if (meta.data?.[dataset]) return; // Legacy monolithic snapshot.
      data[dataset] = cached?.owner === owner &&
        (cached.versions[dataset] ?? "0") === (meta.versions[dataset] ?? "0")
        ? cached.data[dataset]
        : await cache.get(syncDataKey(owner, dataset)) ?? {};
    }));
  }
  const pending = pendingRows.filter(a => a.owner === owner);
  await tx.done;
  return { snapshot: meta ? { ...meta, data } : undefined, pending };
}

/** Dataset writes, metadata and ACK removal are still one atomic transaction.
 * Queue independent requests together instead of paying a round trip per row. */
export async function commitLocalSync(owner: string, snapshot: SyncSnapshot, ids: string[]): Promise<void> {
  if (snapshot.owner !== owner) throw Error("OWNER_CHANGED");
  const tx = (await database()).transaction(["cache", "answer"], "readwrite");
  void tx.done.catch(() => {});
  const writes: Promise<unknown>[] = [];
  try {
    const cache = tx.objectStore("cache"), answers = tx.objectStore("answer");
    const previous: SyncSnapshot | undefined = await cache.get(snapshotKey(owner));
    if (previous && datasets.some(dataset =>
      BigInt(previous.versions[dataset] ?? "0") > BigInt(snapshot.versions[dataset] ?? "0")))
      throw Error("STALE_SYNC");
    for (const dataset of datasets) {
      // Reuse unchanged dictionaries even when answers/learning change.
      if (!previous || previous.data || (previous.versions[dataset] ?? "0") !== (snapshot.versions[dataset] ?? "0"))
        writes.push(cache.put(snapshot.data[dataset], syncDataKey(owner, dataset)));
    }
    const { data: ignored, ...meta } = snapshot;
    void ignored;
    writes.push(cache.put(meta, snapshotKey(owner)));
    writes.push(...ids.map(async id => {
      const answer: QueuedAnswer | undefined = await answers.get(id);
      if (answer?.owner === owner) await answers.delete(id);
    }));
    await storageDeadline(Promise.all([...writes, tx.done]));
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction already finished. */ }
    await Promise.allSettled([...writes, tx.done]);
    throw error;
  }
}
