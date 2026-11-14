import { database, storageDeadline } from "../game/data/database";
import { gameAssetUrls } from "../game/asset-url";
import { preparedGame } from "./prepared";
import { SyncEngine } from "./engine";
import { datasets, versionsMatch, snapshotKey, type QueuedAnswer, type SyncSnapshot, type SyncPacket, type Versions } from "./types";
import type { Kind } from "../game/types";

let owner: string | null = null;
let engine: SyncEngine | undefined;
let requests = new AbortController();
let media: Promise<void> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let syncFlight: { owner: string; work: Promise<SyncSnapshot> } | undefined;
let wakeAgain = false;
let localSnapshot: SyncSnapshot | undefined;
const dataKey = (user: string, dataset: string) => `sync-data-v1:${user}:${dataset}`;

async function readSnapshot(user: string): Promise<SyncSnapshot | undefined> {
  const tx = (await database()).transaction("cache", "readonly");
  const meta: SyncSnapshot | undefined = await tx.store.get(snapshotKey(user));
  if (!meta) { await tx.done; return; }
  const data = meta.data ?? {} as SyncSnapshot["data"];
  for (const dataset of datasets) {
    if (meta.data?.[dataset]) continue; // Upgrade an older monolithic snapshot safely.
    data[dataset] = localSnapshot?.owner === user &&
      (localSnapshot.versions[dataset] ?? "0") === (meta.versions[dataset] ?? "0")
      ? localSnapshot.data[dataset] : await tx.store.get(dataKey(user, dataset)) ?? {};
  }
  await tx.done;
  localSnapshot = { ...meta, data };
  return localSnapshot;
}

async function json(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([requests.signal, AbortSignal.timeout(60000)]) });
  if (!response.ok) throw Error(response.status === 401 ? "LOGIN" : "SYNC_FAILED");
  return response.json();
}
function warmMedia() {
  return media ??= (async () => {
    const urls = gameAssetUrls();
    let index = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (index < urls.length) {
        const url = urls[index++];
        const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw Error("MEDIA_FAILED");
        await response.arrayBuffer();
      }
    }));
  })().catch(error => { media = undefined; throw error; });
}
async function pullPages(versions: Versions): Promise<SyncPacket> {
  let base = versions;
  const changes: SyncPacket["changes"] = [];
  for (let pass = 0; pass < 10; pass++) {
    let through: Versions | undefined;
    for (const dataset of datasets) {
      if (through && (base[dataset] ?? "0") === (through[dataset] ?? "0")) continue;
      let after: [string, string] | null = null;
      do {
        const page: SyncPacket & { done: boolean; after: [string, string] | null } = await json("/api/sync", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versions: base, dataset, through, after }),
        });
        if (page.owner !== owner || page.protocol !== 1) throw Error("OWNER_CHANGED");
        through = page.versions; changes.push(...page.changes); after = page.done ? null : page.after;
        if (!page.done && !after) throw Error("INVALID_SYNC");
      } while (after);
    }
    base = through ?? base;
    const latest = await json("/api/sync");
    if (latest.owner !== owner) throw Error("OWNER_CHANGED");
    if (!latest.pending_learning && versionsMatch(base, latest.versions)) return { owner: owner!, protocol: 1, versions: base, changes };
  }
  throw Error("SYNC_BUSY");
}
function makeEngine(user: string) {
  return new SyncEngine(user, {
    read: () => readSnapshot(user),
    pending: async () => ((await (await database()).getAll("answer")) as QueuedAnswer[]).filter(a => a.owner === user),
    commit: async (snapshot, ids) => {
      if (owner !== user) throw Error("OWNER_CHANGED");
      const db = await database(), tx = db.transaction(["cache", "answer"], "readwrite");
      void tx.done.catch(() => {});
      const previous: SyncSnapshot | undefined = await tx.objectStore("cache").get(snapshotKey(user));
      if (previous && Object.entries(previous.versions).some(([d, v]) => BigInt(v!) > BigInt(snapshot.versions[d as keyof Versions] ?? "0"))) {
        tx.abort(); throw Error("STALE_SYNC");
      }
      // Common dictionaries/choice banks are not rewritten after each answer.
      for (const dataset of datasets) {
        if (!previous || previous.data || (previous.versions[dataset] ?? "0") !== (snapshot.versions[dataset] ?? "0"))
          await tx.objectStore("cache").put(snapshot.data[dataset], dataKey(user, dataset));
      }
      const { data: ignored, ...meta } = snapshot;
      void ignored;
      await tx.objectStore("cache").put(meta, snapshotKey(user));
      for (const id of ids) {
        const entry: QueuedAnswer | undefined = await tx.objectStore("answer").get(id);
        if (entry?.owner === user) await tx.objectStore("answer").delete(id);
      }
      await storageDeadline(tx.done);
      localSnapshot = snapshot;
    },
  }, {
    manifest: () => json("/api/sync"),
    pull: pullPages,
    push: answers => json("/api/game/answers", { method: "POST", headers: { "Content-Type": "application/json", "X-Sokudoku-User": user },
      body: JSON.stringify(answers.map(({ owner: ignored, ...a }) => {
        void ignored;
        return a.time_limit_ms !== null && a.time_limit_ms > 10000 && a.result !== "timeout"
          ? { ...a, time_limit_ms: null, response_ms: null } : a;
      })) }),
  });
}
async function synchronize() {
  const user = owner, active = engine;
  if (!user || !active) throw Error("LOGIN");
  if (syncFlight?.owner === user) return syncFlight.work;
  const work = (async () => {
  const run = () => active.run();
  const snapshot = typeof navigator.locks?.request === "function"
    ? await navigator.locks.request(`sokudoku-sync:${user}`, run) : await run();
  if (owner !== user) throw Error("OWNER_CHANGED");
  postMessage({ type: "updated", owner: user, savedAt: snapshot.savedAt });
  return snapshot;
  })();
  syncFlight = { owner: user, work };
  try { return await work; } finally {
    if (syncFlight?.work === work) syncFlight = undefined;
    if (wakeAgain && owner === user) { wakeAgain = false; queueMicrotask(background); }
  }
}
function background() {
  void Promise.all([synchronize(), warmMedia()]).catch(error => {
    postMessage({ type: "error", error: (error as Error).message });
  }).finally(() => {
    clearTimeout(retryTimer);
    if (owner) retryTimer = setTimeout(background, 15000);
  });
}
self.onmessage = async ({ data }: MessageEvent<{ id?: number; type: string; owner?: string | null; levels?: string | null; kinds?: Kind[] }>) => {
  try {
    if (data.type === "owner") {
      if (owner === data.owner) return;
      requests.abort(); requests = new AbortController();
      clearTimeout(retryTimer);
      owner = data.owner ?? null; engine = owner ? makeEngine(owner) : undefined;
      if (owner) background();
      return;
    }
    if (data.type === "kick") {
      if (owner) {
        if (syncFlight?.owner === owner) wakeAgain = true;
        else background();
      }
      return;
    }
    if (!owner) throw Error("LOGIN");
    let snapshot = await readSnapshot(owner);
    if (data.type === "sync" || !snapshot?.savedAt) snapshot = await synchronize();
    // A complete local snapshot is playable even while uploads/catch-up continue.
    // The game replays its durable local outbox onto this canonical snapshot.
    if (data.type === "prepare") await warmMedia();
    if (!snapshot || snapshot.owner !== owner) throw Error("LOGIN");
    postMessage({ id: data.id, result: data.type === "prepare" ? preparedGame(snapshot, data.levels ?? null, data.kinds ?? []) : true });
  } catch (error) { postMessage({ id: data.id, error: (error as Error).message }); }
};
