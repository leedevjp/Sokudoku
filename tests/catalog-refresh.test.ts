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

test("sync keeps the visible question intact but replaces the very next question", async () => {
  const engine = await LearningEngine.create();
  const planner = new TrainingPlanner(engine, words, ["meaning"], ["exam"], () => 0.4);
  const first = planner.next()!, options = first.options.map(w => w.meaning_ko);
  let applied = 0;
  planner.stageCatalog([...fresh, { ...words[0], id: "new-id", term: "new addition", meaning_ko: "new meaning addition" }], undefined, () => applied++);
  assert.equal(applied, 0); assert.ok(first.word.term.startsWith("old"));
  assert.deepEqual(first.options.map(w => w.meaning_ko), options);
  // Skip the four pending old questions as soon as fresh data is ready.
  await planner.prepareSet();
  assert.equal(applied, 1);
  const next = planner.next()!;
  assert.ok(next.word.term.startsWith("new"));
  for (let i = 0; i < 4; i++) assert.notEqual(planner.next()!.word.id, "0");
  assert.equal(planner.engine, engine);
});

test("a refresh arriving during preparation replaces its pending old set safely", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { release = r; }), began = new Promise<void>(r => { started = r; });
  let calls = 0, nextCalls = 0, applied = 0;
  const planner = new TrainingPlanner(await LearningEngine.create(), words, ["meaning"], ["exam"], () => 0.4,
    async () => { if (++calls === 1) { started(); await gate; } });
  const preparing = planner.prepareSet(); await began;
  planner.stageCatalog(fresh, async () => { nextCalls++; }, () => applied++);
  release(); await preparing;
  assert.equal(applied, 1); assert.equal(nextCalls, 5);
  // Awaiting preparation now includes a catalog staged while work yielded;
  // the immediately following next() must be ready, without SET_NOT_PREPARED.
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
  await data.planner.prepareSet();
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

test("answering the visible old question updates the staged FSRS engine too", async () => {
  const original = await LearningEngine.create();
  const incoming = await LearningEngine.create();
  const planner = new TrainingPlanner(original, words, ["meaning"], ["exam"], () => 0.4);
  const current = planner.next()!;
  planner.stageCatalog(fresh, undefined, undefined, incoming);
  const answer = { id: "local-answer", word_id: current.word.id, question_type: "meaning" as const,
    selected_word_id: current.word.id, result: "correct" as const,
    response_ms: 250, time_limit_ms: 10000, answered_at: new Date().toISOString() };
  planner.record(answer, current.word);
  await planner.prepareSet();
  assert.equal(planner.engine, incoming);
  assert.equal(planner.engine.learner.review_count, 1);
  assert.equal(planner.engine.words.get(`word:${current.word.id}:meaning`)?.last_answer_id, answer.id);
});

test("a learning-only server refresh applies at the next question without catalog changes", async t => {
  const remote = await LearningEngine.create();
  const word = words[1];
  remote.apply({ id: "remote-answer", word_id: word.id, question_type: "meaning",
    result: "correct", answered_at: new Date().toISOString(), source: "word", difficulty: word.difficulty });
  let fetches = 0;
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({
    user_id: "owner", words, stats: [],
    catalogVersion: "unchanged", syncVersion: ++fetches,
    learning: fetches === 1 ? undefined : remote.snapshot(),
  }));
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exam"], onLoginRequired() {} });
  const data = await runtime.load();
  const first = data.planner.next()!;
  await runtime.refreshCatalog();
  assert.equal(first.options.length, 4);
  await data.planner.prepareSet();
  assert.equal(data.planner.engine.words.get(`word:${word.id}:meaning`)?.last_answer_id, "remote-answer");
  runtime.dispose();
});


for (const incremental of [false, true]) test(`own-answer sync ACK retains the exact pending questions and current FSRS engine (delta=${incremental})`, async t => {
  const server = await LearningEngine.create();
  let fetches = 0;
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => {
    fetches++;
    return {
      user_id: "owner", words, stats: [], catalogVersion: "same", syncVersion: fetches,
      learning: fetches === 1 ? undefined : server.snapshot(),
      ...(incremental ? {
        learningKey: String(fetches), learningIndex: new Map(server.words),
        learningDelta: fetches > 1 ? { baseKey: String(fetches - 1), words: [...server.words.values()], removed: [] } : undefined,
      } : {}),
      pendingAnswers: [],
    };
  });
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  t.mock.method(AnswerJournal.prototype, "record", () => {});
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exam"], onLoginRequired() {} });
  const data = await runtime.load();
  const first = data.planner.next()!;
  const answer = {
    id: "already-played", word_id: first.word.id, question_type: "meaning" as const,
    selected_word_id: first.word.id, result: "correct" as const,
    response_ms: 250, time_limit_ms: 10000, answered_at: "2026-11-15T00:00:00.000Z",
  };
  data.planner.record(answer, first.word);
  runtime.record(answer);
  server.apply({ ...answer, source: "word", difficulty: first.word.difficulty });
  // Server revision is bookkeeping: it changes even when the local cards
  // already contain precisely the answers just acknowledged.
  server.learner.revision = 9;

  const queue = (data.planner as unknown as { queue: unknown[] }).queue;
  const expectedNext = queue[0];
  const currentEngine = data.planner.engine;
  assert.equal(queue.length, 4);

  await runtime.refreshCatalog();
  await data.planner.prepareSet();
  assert.equal(data.planner.engine, currentEngine);
  assert.equal((data.planner as unknown as { queue: unknown[] }).queue, queue, "ACK must not reset the quiz queue");
  assert.equal(data.planner.next(), expectedNext, "the same prepared question should be shown next");

  // Repeated sync notifications must also leave the remaining questions alone.
  const remaining = (data.planner as unknown as { queue: unknown[] }).queue;
  await runtime.refreshCatalog();
  await data.planner.prepareSet();
  assert.equal((data.planner as unknown as { queue: unknown[] }).queue, remaining);
  runtime.dispose();
});

test("a genuinely new remote answer still invalidates pending questions", async t => {
  const remote = await LearningEngine.create();
  let fetches = 0;
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({
    user_id: "owner", words, stats: [], catalogVersion: "same",
    syncVersion: ++fetches, learning: fetches === 1 ? undefined : remote.snapshot(),
    pendingAnswers: [],
  }));
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exam"], onLoginRequired() {} });
  const data = await runtime.load();
  data.planner.next();
  const oldQueue = (data.planner as unknown as { queue: unknown[] }).queue;
  remote.apply({
    id: "other-device", word_id: words[2].id, question_type: "meaning",
    result: "incorrect", source: "word", difficulty: words[2].difficulty,
    answered_at: "2026-11-15T00:00:00.000Z",
  });
  await runtime.refreshCatalog();
  await data.planner.prepareSet();
  assert.notEqual((data.planner as unknown as { queue: unknown[] }).queue, oldQueue);
  assert.equal(data.planner.engine.words.get("word:2:meaning")?.last_answer_id, "other-device");
  runtime.dispose();
});
