import { applyPacket, emptySnapshot, versionsMatch, type QueuedAnswer, type SyncPacket, type SyncSnapshot, type Versions } from "./types";

export type SyncStore = {
  read: () => Promise<SyncSnapshot | undefined>;
  pending: () => Promise<QueuedAnswer[]>;
  commit: (snapshot: SyncSnapshot, acknowledged: string[]) => Promise<void>;
};
export type SyncTransport = {
  manifest: () => Promise<{ owner: string; versions: Versions; protocol: number; pending_learning?: boolean }>;
  pull: (versions: Versions) => Promise<SyncPacket>;
  push: (answers: QueuedAnswer[]) => Promise<{ user_id: string; ids: string[]; discarded_ids?: string[] }>;
};

/** Server revisions describe downloads; UUID outbox entries describe uploads. */
export class SyncEngine {
  private flight?: Promise<SyncSnapshot>;
  constructor(readonly owner: string, private store: SyncStore, private transport: SyncTransport) {}
  run() {
    if (this.flight) return this.flight;
    const work = this.synchronize();
    this.flight = work;
    void work.finally(() => { if (this.flight === work) this.flight = undefined; }).catch(() => {});
    return work;
  }
  private async synchronize() {
    let snapshot = await this.store.read() ?? emptySnapshot(this.owner);
    if (snapshot.owner !== this.owner) throw Error("OWNER_CHANGED");
    const pending = (await this.store.pending()).filter(a => a.owner === this.owner);
    const acknowledged: string[] = [];
    for (let i = 0; i < pending.length; i += 200) {
      const batch = pending.slice(i, i + 200);
      const reply = await this.transport.push(batch);
      if (reply.user_id !== this.owner) throw Error("OWNER_CHANGED");
      const ids = new Set([...(reply.ids ?? []), ...(reply.discarded_ids ?? [])]);
      if (batch.some(a => !ids.has(a.id))) throw Error("ACK_MISSING");
      acknowledged.push(...batch.map(a => a.id));
    }
    const manifest = await this.transport.manifest();
    if (manifest.owner !== this.owner || manifest.protocol !== 1) throw Error("OWNER_CHANGED");
    if (!snapshot.savedAt || acknowledged.length || manifest.pending_learning || !versionsMatch(snapshot.versions, manifest.versions)) {
      snapshot = applyPacket(snapshot, await this.transport.pull(snapshot.versions));
      // Cursor, downloaded state and acknowledged queue removal commit together.
      // A crash between server ACK and this commit simply replays the same UUIDs.
      await this.store.commit(snapshot, acknowledged);
    }
    return snapshot;
  }
}
