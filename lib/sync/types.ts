import type { Answer } from "../game/types";

export const datasets = ["words", "personal_words", "distractors", "extra_choices", "answers", "learning_states", "learner"] as const;
export type Dataset = typeof datasets[number];
export type Versions = Partial<Record<Dataset, string>>;
export const catalogVersion = (versions: Versions) => JSON.stringify(
  ["words", "personal_words", "distractors", "extra_choices"].map(d => versions[d as Dataset] ?? "0"),
);
export type SyncRow = Record<string, unknown>;
export type SyncSnapshot = {
  owner: string; protocol: 1; versions: Versions;
  data: Record<Dataset, Record<string, SyncRow>>;
  savedAt: number;
};
export type SyncPacket = {
  owner: string; protocol: 1; versions: Versions;
  changes: { dataset: Dataset; key: string; version: string; deleted: boolean; value: SyncRow | null }[];
};
export type QueuedAnswer = Answer & { owner: string };
export const snapshotKey = (owner: string) => `sync-v1:${owner}`;
export function emptySnapshot(owner: string): SyncSnapshot {
  return { owner, protocol: 1, versions: {}, savedAt: 0,
    data: Object.fromEntries(datasets.map(d => [d, {}])) as SyncSnapshot["data"] };
}
export function versionsMatch(local: Versions, remote: Versions) {
  return datasets.every(d => (local[d] ?? "0") === (remote[d] ?? "0"));
}
export function applyPacket(current: SyncSnapshot, packet: SyncPacket): SyncSnapshot {
  if (packet.owner !== current.owner || packet.protocol !== 1) throw Error("OWNER_CHANGED");
  const data = { ...current.data };
  for (const dataset of datasets) {
    if (BigInt(packet.versions[dataset] ?? "0") < BigInt(current.versions[dataset] ?? "0"))
      throw Error("STALE_SYNC");
  }
  const copied = new Set<Dataset>();
  for (const change of packet.changes) {
    if (!datasets.includes(change.dataset)) throw Error("INVALID_SYNC");
    if (!copied.has(change.dataset)) {
      data[change.dataset] = { ...data[change.dataset] };
      copied.add(change.dataset);
    }
    if (change.deleted) delete data[change.dataset][change.key];
    else if (change.value) data[change.dataset][change.key] = change.value;
  }
  return { owner: packet.owner, protocol: 1, versions: packet.versions, data, savedAt: Date.now() };
}
