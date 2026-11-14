import { database } from "../game/data/database";
import { gameAssetUrls } from "../game/asset-url";
import { preparedGame } from "./prepared";
import { SyncEngine } from "./engine";
import { catalogVersion, datasets, versionsMatch, type QueuedAnswer, type SyncSnapshot, type SyncPacket, type Versions } from "./types";
import { readLegacyGame } from "./legacy";
import type { Kind } from "../game/types";
import { browserMediaDownloads } from "./media";
import { readLocalSync, commitLocalSync } from "./local-store";

let owner: string | null = null;
let engine: SyncEngine | undefined;
let requests = new AbortController();
const mediaDownloads = browserMediaDownloads();
let media: Promise<void> | undefined;
let mediaComplete = false;
let mediaTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let syncFlight: { owner: string; work: Promise<SyncSnapshot> } | undefined;
let wakeAgain = false;
let localSnapshot: SyncSnapshot | undefined;
async function readSnapshot(user: string, includePending = false) {
  const state = await readLocalSync(user, localSnapshot, includePending);
  if (state.snapshot) localSnapshot = state.snapshot;
  return state;
}

async function json(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([requests.signal, AbortSignal.timeout(60000)]) });
  if (!response.ok) throw Error(response.status === 401 ? "LOGIN" : "SYNC_FAILED");
  return response.json();
}
function warmMedia() {
  if (mediaComplete) return Promise.resolve();
  if (media) return media;
  clearTimeout(mediaTimer);
  // Images first. Media has its own retry clock, independent of user sync.
  const urls = gameAssetUrls().sort((a, b) => Number(!a.endsWith(".webp")) - Number(!b.endsWith(".webp")));
  const work = mediaDownloads.warm(urls).then(complete => {
    mediaComplete = complete;
    if (!complete) mediaTimer = setTimeout(() => { void warmMedia(); }, 15000);
  }).finally(() => { media = undefined; });
  media = work;
  return work;
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
    read: async () => (await readSnapshot(user)).snapshot,
    pending: async () => ((await (await database()).getAll("answer")) as QueuedAnswer[]).filter(a => a.owner === user),
    commit: async (snapshot, ids) => {
      if (owner !== user) throw Error("OWNER_CHANGED");
      await commitLocalSync(user, snapshot, ids);
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
  postMessage({ type: "updated", owner: user, savedAt: snapshot.savedAt, catalogVersion: catalogVersion(snapshot.versions) });
  return snapshot;
  })();
  syncFlight = { owner: user, work };
  try { return await work; } finally {
    if (syncFlight?.work === work) syncFlight = undefined;
    if (wakeAgain && owner === user) { wakeAgain = false; queueMicrotask(background); }
  }
}
function background() {
  void warmMedia();
  const user = owner;
  void synchronize().catch(error => {
    postMessage({ type: "error", error: (error as Error).message });
  }).finally(() => {
    if (owner && owner === user) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(background, 15000);
    }
  });
}
self.onmessage = async ({ data }: MessageEvent<{ id?: number; type: string; owner?: string | null; levels?: string | null; kinds?: Kind[]; knownCatalogKey?: string; url?: string; priority?: boolean }>) => {
  try {
    if (data.type === "media") {
      if (!data.url || !gameAssetUrls().includes(data.url)) throw Error("INVALID_MEDIA");
      postMessage({ id: data.id, result: await mediaDownloads.get(data.url, data.priority !== false) });
      return;
    }
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
    const playable = await readSnapshot(owner, data.type === "prepare");
    let snapshot = playable.snapshot;
    const hadSnapshot = !!snapshot?.savedAt;
    if (data.type === "prepare" && !hadSnapshot) {
      const legacy = await readLegacyGame(owner, data.levels ?? null, data.kinds ?? []);
      if (legacy) { postMessage({ id: data.id, result: legacy }); return; }
    }
    if (data.type === "sync" || !snapshot?.savedAt) {
      snapshot = await synchronize();
      // Initial sync created a snapshot; capture its outbox atomically too.
      if (data.type === "prepare") {
        const updated = await readSnapshot(owner, true);
        snapshot = updated.snapshot;
        playable.pending = updated.pending;
      }
    }
    // The root worker owns both snapshot and pending answers, so a refresh
    // cannot remove the queue between separate page-level reads.
    if (!snapshot || snapshot.owner !== owner) throw Error("LOGIN");
    postMessage({ id: data.id, result: data.type === "prepare"
      ? { ...preparedGame(snapshot, data.levels ?? null, data.kinds ?? [], data.knownCatalogKey),
          pendingAnswers: playable.pending }
      : true });
  } catch (error) { postMessage({ id: data.id, error: (error as Error).message }); }
};
