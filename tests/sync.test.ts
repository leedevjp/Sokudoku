import test from "node:test";
import assert from "node:assert/strict";
import { SyncEngine, type SyncTransport } from "../lib/sync/engine";
import { applyPacket, emptySnapshot, type QueuedAnswer, type SyncSnapshot, type SyncPacket } from "../lib/sync/types";

const answer = (id: string, owner = "a"): QueuedAnswer => ({ id, owner, source: "word", word_id: "w", question_type: "meaning", selected_word_id: "w", result: "correct", response_ms: 100, time_limit_ms: 10000, answered_at: "2026-11-14T00:00:00Z" });
const packet = (version: string, changes: SyncPacket["changes"] = []): SyncPacket => ({ owner: "a", protocol: 1, versions: { answers: version }, changes });
function harness() {
  let snapshot: SyncSnapshot | undefined;
  let outbox = [answer("one")];
  const stored = new Set<string>();
  let pulls = 0, failPull = false, version = 0;
  const transport: SyncTransport = {
    async push(batch) {
      for (const a of batch) if (!stored.has(a.id)) { stored.add(a.id); version++; }
      return { user_id: "a", ids: batch.map(a => a.id) };
    },
    async manifest() { return { owner: "a", protocol: 1, versions: { answers: String(version) } }; },
    async pull() { pulls++; if (failPull) throw Error("offline"); return packet(String(version)); },
  };
  const store = { async read() { return snapshot; }, async pending() { return outbox; },
    async commit(next: SyncSnapshot, ids: string[]) { snapshot = next; outbox = outbox.filter(a => !ids.includes(a.id)); } };
  return { store, transport, stored, get snapshot() { return snapshot; }, get outbox() { return outbox; }, get pulls() { return pulls; },
    fail(value: boolean) { failPull = value; }, add(a: QueuedAnswer) { outbox.push(a); } };
}
test("crash after server ACK retains outbox until downloaded state and cursor commit; UUID replay is harmless", async () => {
  const h = harness(); h.fail(true);
  await assert.rejects(new SyncEngine("a", h.store, h.transport).run(), /offline/);
  assert.equal(h.stored.size, 1); assert.equal(h.outbox.length, 1); assert.equal(h.snapshot, undefined);
  h.fail(false);
  const restored = await new SyncEngine("a", h.store, h.transport).run();
  assert.equal(h.stored.size, 1); assert.equal(h.outbox.length, 0); assert.equal(restored.versions.answers, "1");
});
test("unchanged manifests do not download; new local answers upload even when server cursor matches", async () => {
  const h = harness(), engine = new SyncEngine("a", h.store, h.transport);
  await engine.run(); const pulls = h.pulls;
  await engine.run(); assert.equal(h.pulls, pulls);
  h.add(answer("two")); await engine.run();
  assert.equal(h.stored.size, 2); assert.equal(h.snapshot?.versions.answers, "2");
});
test("simultaneous wakeups share a run and never acknowledge another account", async () => {
  const h = harness(), engine = new SyncEngine("a", h.store, h.transport);
  assert.deepEqual(await Promise.all([engine.run(), engine.run()]), [h.snapshot, h.snapshot]);
  h.add(answer("other", "b")); await engine.run(); assert.equal(h.outbox.length, 1);
  h.add(answer("mine")); h.transport.push = async () => ({ user_id: "b", ids: ["mine"] });
  await assert.rejects(engine.run(), /OWNER_CHANGED/); assert.equal(h.outbox.length, 2);
});
test("deletions apply without touching local outbox; stale packets cannot regress a cursor", () => {
  let s = emptySnapshot("a");
  s = applyPacket(s, packet("1", [{ dataset: "words", key: "w", version: "1", deleted: false, value: { id: "w" } }]));
  assert.ok(s.data.words.w);
  s = applyPacket(s, packet("2", [{ dataset: "words", key: "w", version: "2", deleted: true, value: null }]));
  assert.equal(s.data.words.w, undefined);
  assert.throws(() => applyPacket(s, packet("1")), /STALE_SYNC/);
});
test("two devices merge disjoint answer UUIDs instead of replacing each other's records", async () => {
  const server = new Map<string, QueuedAnswer>();
  let version = 0;
  const transport: SyncTransport = {
    async push(batch) { for (const a of batch) if (!server.has(a.id)) { server.set(a.id, a); version++; } return { user_id: "a", ids: batch.map(a => a.id) }; },
    async manifest() { return { owner: "a", protocol: 1, versions: { answers: String(version) } }; },
    async pull() { return packet(String(version), [...server].map(([key, a]) => ({ dataset: "answers", key, version: String(version), deleted: false, value: { ...a } }))); },
  };
  const device = (id: string) => {
    let snapshot: SyncSnapshot | undefined; let queue = [answer(id)];
    const engine = new SyncEngine("a", { async read() { return snapshot; }, async pending() { return queue; }, async commit(s, ids) { snapshot = s; queue = queue.filter(a => !ids.includes(a.id)); } }, transport);
    return { engine, get snapshot() { return snapshot; }, get queue() { return queue; } };
  };
  const phone = device("phone"), pc = device("pc");
  await Promise.all([phone.engine.run(), pc.engine.run()]);
  await Promise.all([phone.engine.run(), pc.engine.run()]);
  assert.equal(server.size, 2);
  for (const d of [phone, pc]) { assert.deepEqual(Object.keys(d.snapshot!.data.answers).sort(), ["pc", "phone"]); assert.equal(d.queue.length, 0); }
});
