import { database } from "../game/data/database";
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
  const meta: SyncSnapshot | undefined = await cache.get(snapshotKey(owner));
  const data = meta?.data ?? {} as SyncSnapshot["data"];
  if (meta) {
    if (meta.owner !== owner) throw Error("OWNER_CHANGED");
    for (const dataset of datasets) {
      if (meta.data?.[dataset]) continue; // Legacy monolithic snapshot.
      data[dataset] = cached?.owner === owner &&
        (cached.versions[dataset] ?? "0") === (meta.versions[dataset] ?? "0")
        ? cached.data[dataset]
        : await cache.get(syncDataKey(owner, dataset)) ?? {};
    }
  }
  const pending = includePending
    ? ((await tx.objectStore("answer").getAll()) as QueuedAnswer[])
        .filter(a => a.owner === owner)
    : [];
  await tx.done;
  return { snapshot: meta ? { ...meta, data } : undefined, pending };
}
