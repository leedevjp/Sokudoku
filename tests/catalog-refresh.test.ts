import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../lib/game/learning/engine";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { TrainingRuntime } from "../lib/game/data/training-runtime";
import { GameDataLoader } from "../lib/game/data/bootstrap";
import { AnswerJournal } from "../lib/game/data/answer-journal";
import type { Word } from "../lib/game/types";

const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i), term: `old${i}`, kana: `かな${i}`, meaning_ko: `old meaning${i}`,
  hanja_reading: null, has_kanji: true, difficulty: 0, deleted_at: null,
}));
const fresh = words.slice(1).map(w => ({ ...w, term: `new${w.id}`, meaning_ko: `new meaning${w.id}` }));

test("catalog refresh freezes current/queued questions and adopts additions, edits and deletions at the next set", async () => {
  const engine = await LearningEngine.create();
  const planner = new TrainingPlanner(engine, words, ["meaning"], ["exam"], () => 0.4);
  const first = planner.next()!, options = first.options.map(w => w.meaning_ko);
  let applied = 0;
  planner.stageCatalog([...fresh, { ...words[0], id: "new-id", term: "new addition", meaning_ko: "new meaning addition" }], undefined, () => applied++);
  assert.equal(applied, 0); assert.ok(first.word.term.startsWith("old"));
  assert.deepEqual(first.options.map(w => w.meaning_ko), options);
  for (let i = 0; i < 4; i++) assert.ok(planner.next()!.word.term.startsWith("old"));
  assert.equal(applied, 0);
  const next = planner.next()!;
  assert.equal(applied, 1); assert.ok(next.word.term.startsWith("new"));
  for (let i = 0; i < 4; i++) assert.notEqual(planner.next()!.word.id, "0");
  assert.equal(planner.engine, engine);
});

test("an in-flight reading preparation finishes against its original catalog", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { release = r; }), began = new Promise<void>(r => { started = r; });
  let calls = 0, nextCalls = 0, applied = 0;
  const planner = new TrainingPlanner(await LearningEngine.create(), words, ["meaning"], ["exam"], () => 0.4,
    async () => { if (++calls === 1) { started(); await gate; } });
  const preparing = planner.prepareSet(); await began;
  planner.stageCatalog(fresh, async () => { nextCalls++; }, () => applied++);
  release(); await preparing;
  assert.equal(applied, 0); assert.equal(nextCalls, 0);
  for (let i = 0; i < 5; i++) assert.ok(planner.next()!.word.term.startsWith("old"));
  await planner.prepareSet();
  assert.equal(applied, 1); assert.equal(nextCalls, 5);
  assert.ok(planner.next()!.word.term.startsWith("new"));
});

test("runtime background refresh preserves the active planner and learning history", async t => {
  let fetches = 0;
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({
    user_id: "owner", words: fetches++ ? fresh : words, stats: [], catalogVersion: fetches === 1 ? "old" : "new",
  }));
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exam"], onLoginRequired() {} });
  const data = await runtime.load(), first = data.planner.next()!;
  data.planner.record({ id: "answer", word_id: first.word.id, question_type: "meaning", selected_word_id: first.word.id,
    result: "correct", response_ms: 100, time_limit_ms: 10000, answered_at: new Date().toISOString() }, first.word);
  await runtime.refreshCatalog();
  for (let i = 0; i < 4; i++) assert.ok(data.planner.next()!.word.term.startsWith("old"));
  assert.ok(data.planner.next()!.word.term.startsWith("new"));
  assert.equal(data.planner.engine.learner.review_count, 1);
  runtime.dispose();
});

test("a refresh that finishes after exit cannot replace a disposed game's catalog", async t => {
  let resolve!: (value: { user_id: string; words: Word[]; stats: []; catalogVersion: string }) => void;
  let calls = 0;
  const delayed = new Promise<{ user_id: string; words: Word[]; stats: []; catalogVersion: string }>(r => { resolve = r; });
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ++calls === 1 ? { user_id: "owner", words, stats: [], catalogVersion: "old" } : delayed);
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exam"], onLoginRequired() {} });
  const data = await runtime.load();
  const refresh = runtime.refreshCatalog(); runtime.dispose();
  resolve({ user_id: "owner", words: fresh, stats: [], catalogVersion: "new" }); await refresh;
  for (let i = 0; i < 6; i++) assert.ok(data.planner.next()!.word.term.startsWith("old"));
});
