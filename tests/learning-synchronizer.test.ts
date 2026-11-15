import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeLearning } from "../lib/game/learning/synchronizer";
import { LearningEngine } from "../lib/game/learning/engine";
import { LEARNING_VERSION, type LearningEvent, type LearningSnapshot } from "../lib/game/learning/types";

const event = (id: string, word_id: string, day: number): LearningEvent => ({
  id, word_id, source: "word", question_type: "meaning", result: "correct", difficulty: 3,
  answered_at: `2026-11-${String(day).padStart(2, "0")}T00:00:00.000Z`,
});
async function fixture() {
  const history = [event("a", "one", 1), event("b", "two", 2)];
  let pending = [event("c", "one", 3), event("d", "three", 4)];
  let engine = await LearningEngine.create();
  history.forEach(e => engine.apply(e));
  engine.learner.revision = 7;
  let canonical = engine.snapshot(), failures = 0;
  const calls: string[] = [], writes: { states: LearningSnapshot["words"]; expected_revision: number }[] = [];
  const client = { async rpc(name: string, args?: Record<string, unknown>) {
    calls.push(name);
    if (name === "learning_work") return { data: { learner: canonical.learner,
      words: canonical.words.filter(w => pending.some(e => e.word_id === w.word_ref)), events: pending }, error: null };
    if (name === "learning_history") return { data: [...history, ...pending], error: null };
    if (name === "learning_snapshot") return { data: canonical, error: null };
    assert.equal(name, "commit_learning");
    const write = args as unknown as typeof writes[number]; writes.push(write);
    if (failures-- > 0) return { data: false, error: null };
    const states = new Map(canonical.words.map(w => [w.word_ref, w]));
    write.states.forEach(w => states.set(w.word_ref, w));
    canonical = { learner: { ...(args!.learner as NonNullable<LearningSnapshot["learner"]>), revision: write.expected_revision + 1 }, words: [...states.values()] };
    pending = [];
    return { data: true, error: null };
  } } as unknown as Parameters<typeof synchronizeLearning>[0];
  return { client, calls, writes, history, get pending() { return pending; },
    setPending(value: LearningEvent[]) { pending = value; }, get canonical() { return canonical; },
    conflict() { failures = 1; }, oldModel() { canonical.learner!.model_version = "legacy"; },
    async expected(rebuild = false) {
      engine = await LearningEngine.create(rebuild ? undefined : canonical);
      (rebuild ? [...history, ...pending].sort((a,b) => a.answered_at.localeCompare(b.answered_at) || a.id.localeCompare(b.id)) : pending).forEach(e => engine.apply(e));
      return { learner: { ...engine.learner, revision: 8 }, words: engine.snapshot().words };
    } };
}
const ordered = (snapshot: LearningSnapshot) => ({ ...snapshot, words: [...snapshot.words].sort((a,b) => a.word_ref.localeCompare(b.word_ref)) });

test("touched-card learning matches a full engine and writes only affected states", async () => {
  const f = await fixture(), expected = await f.expected();
  await synchronizeLearning(f.client, false);
  assert.deepEqual(ordered(f.canonical), ordered(expected));
  assert.deepEqual(f.writes[0].states.map(w => w.word_ref), ["one", "three"]);
  assert.deepEqual(f.calls, ["learning_work", "commit_learning"]);
});
test("legacy learning read still returns all cards, including untouched ones", async () => {
  const f = await fixture();
  const result = await synchronizeLearning(f.client);
  assert.equal(result.words.length, 3);
  assert.equal(f.calls.at(-1), "learning_snapshot");
});
test("late offline events rebuild chronologically with the same reducer", async () => {
  const f = await fixture(); f.setPending([event("late", "two", 1)]);
  const expected = await f.expected(true);
  await synchronizeLearning(f.client, false);
  assert.ok(f.calls.includes("learning_history"));
  assert.deepEqual(ordered(f.canonical), ordered(expected));
});
test("model change preserves full-history rebuild", async () => {
  const f = await fixture(); f.oldModel(); const expected = await f.expected(true);
  await synchronizeLearning(f.client, false);
  assert.ok(f.calls.includes("learning_history"));
  assert.equal(f.canonical.learner!.model_version, LEARNING_VERSION);
  assert.deepEqual(ordered(f.canonical), ordered(expected));
});
test("CAS retry reloads the work snapshot; an empty queue does not load all cards", async () => {
  const f = await fixture(); f.conflict(); await synchronizeLearning(f.client, false);
  assert.deepEqual(f.calls, ["learning_work", "commit_learning", "learning_work", "commit_learning"]);
  f.calls.length = 0; await synchronizeLearning(f.client, false);
  assert.deepEqual(f.calls, ["learning_work"]);
});
