import { database, storageDeadline } from "../game/data/database";
import { datasets, snapshotKey, versionsMatch, type QueuedAnswer, type SyncDelta, type SyncSnapshot } from "./types";
import { orderedRowMap, rowLayouts, writeSyncRows } from "./row-store";

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
  { includeHistory = true }: { includeHistory?: boolean } = {},
): Promise<PlayableSyncState> {
  const tx = (await database()).transaction(["cache", "answer", "learning", "history"], "readonly");
  const cache = tx.objectStore("cache");
  void tx.done.catch(() => {});
  const [meta, pendingRows]: [SyncSnapshot | undefined, QueuedAnswer[]] = await Promise.all([
    cache.get(snapshotKey(owner)),
    includePending ? tx.objectStore("answer").index("owner").getAll(owner) : Promise.resolve([]),
  ]);
  const data = meta?.data ?? {} as SyncSnapshot["data"];
  if (meta) {
    if (meta.owner !== owner) throw Error("OWNER_CHANGED");
    await Promise.all(datasets.map(async dataset => {
      if (dataset === "answers" && !includeHistory) { data.answers = {}; return; }
      if (meta.data?.[dataset]) return; // Legacy monolithic snapshot.
      const layout = dataset in rowLayouts ? rowLayouts[dataset as keyof typeof rowLayouts] : undefined;
      data[dataset] = cached?.owner === owner &&
        !(dataset === "answers" && cached.answerHistoryOmitted) &&
        (cached.versions[dataset] ?? "0") === (meta.versions[dataset] ?? "0")
        ? cached.data[dataset]
        : layout && meta[layout.ready]
          ? orderedRowMap(await tx.objectStore(layout.store).index("owner").getAll(owner))
          : await cache.get(syncDataKey(owner, dataset)) ?? {};
    }));
  }
  const pending = pendingRows.filter(a => a.owner === owner);
  await tx.done;
  return { snapshot: meta ? { ...meta, data, ...(includeHistory ? {} : { answerHistoryOmitted: true as const }) } : undefined, pending };
}

/** Dataset writes, metadata and ACK removal are still one atomic transaction.
 * Queue independent requests together instead of paying a round trip per row. */
export async function commitLocalSync(owner: string, snapshot: SyncSnapshot, ids: string[], delta?: SyncDelta): Promise<void> {
  if (snapshot.owner !== owner) throw Error("OWNER_CHANGED");
  if (snapshot.answerHistoryOmitted && !delta) throw Error("INCOMPLETE_SYNC");
  const tx = (await database()).transaction(["cache", "answer", "learning", "history"], "readwrite");
  void tx.done.catch(() => {});
  const writes: Promise<unknown>[] = [];
  try {
    const cache = tx.objectStore("cache"), answers = tx.objectStore("answer");
    const previous: SyncSnapshot | undefined = await cache.get(snapshotKey(owner));
    if (delta && (!versionsMatch(previous?.versions ?? {}, delta.base) ||
      (previous?.localCommit ?? 0) !== (delta.localCommit ?? 0))) throw Error("STALE_SYNC");
    if (previous && datasets.some(dataset =>
      BigInt(previous.versions[dataset] ?? "0") > BigInt(snapshot.versions[dataset] ?? "0")))
      throw Error("STALE_SYNC");
    let historySnapshot = snapshot;
    if (snapshot.answerHistoryOmitted && !previous?.answerRows) {
      // One-time migration: capture the old history and apply the current delta
      // before activating row storage. Normal row commits never read this blob.
      const answers = previous ? previous.data?.answers ?? await cache.get(syncDataKey(owner, "answers")) ?? {} : {};
      for (const change of delta!.changes) if (change.dataset === "answers") {
        if (change.deleted) delete answers[change.key];
        else if (change.value) answers[change.key] = change.value;
      }
      historySnapshot = { ...snapshot, data: { ...snapshot.data, answers } };
    }
    for (const dataset of datasets) {
      if (dataset in rowLayouts) continue;
      // Reuse unchanged dictionaries even when answers/learning change.
      if (!previous || previous.data || (previous.versions[dataset] ?? "0") !== (snapshot.versions[dataset] ?? "0"))
        writes.push(cache.put(snapshot.data[dataset], syncDataKey(owner, dataset)));
    }
    const { data: ignored, answerHistoryOmitted: omitted, ...meta } = snapshot;
    void ignored; void omitted;
    // Row requests below may yield across IDB events. Observe earlier queued
    // failures immediately, then rethrow them through the atomic commit below.
    for (const write of writes) void write.catch(() => {});
    const nextLearningOrdinal = await writeSyncRows(tx, owner, snapshot, previous, delta, writes);
    const nextAnswerOrdinal = await writeSyncRows(tx, owner, historySnapshot, previous, delta, writes, "answers");
    const localCommit = (previous?.localCommit ?? 0) + 1;
    const savedAt = Math.max(snapshot.savedAt, (previous?.savedAt ?? 0) + 1);
    writes.push(cache.delete(syncDataKey(owner, "learning_states")));
    writes.push(cache.delete(syncDataKey(owner, "answers")));
    writes.push(cache.put({ ...meta, savedAt, learningRows: true, nextLearningOrdinal,
      answerRows: true, nextAnswerOrdinal, localCommit }, snapshotKey(owner)));
    writes.push(...ids.map(async id => {
      const answer: QueuedAnswer | undefined = await answers.get(id);
      if (answer?.owner === owner) await answers.delete(id);
    }));
    await storageDeadline(Promise.all([...writes, tx.done]));
    snapshot.localCommit = localCommit;
    snapshot.savedAt = savedAt;
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction already finished. */ }
    await Promise.allSettled([...writes, tx.done]);
    throw error;
  }
}
