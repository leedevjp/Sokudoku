import test from "node:test";
import assert from "node:assert/strict";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { LearningEngine } from "../lib/game/learning/engine";
import {
  parseModes,
  toggleTrainingMode,
  wordKey,
} from "../lib/game/learning/types";
import { TrainingSession } from "../lib/game/session";
import { answerSchema } from "../lib/game/answer-schema";
import type { Word } from "../lib/game/types";
const words: Word[] = Array.from({ length: 10 }, (_, i) => ({
  id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
  term: "term" + i,
  kana: "kana" + i,
  meaning_ko: "meaning" + i,
  hanja_reading: null,
  has_kanji: true,
  difficulty: i % 2,
  deleted_at: null,
  ...(i === 9 ? { source: "personal" as const } : {}),
}));
test("exam is exclusive in restored URLs and UI without changing default modes", () => {
  assert.deepEqual(parseModes(null), ["exploration", "review"]);
  assert.deepEqual(parseModes("review,exam,exploration"), ["exam"]);
  assert.deepEqual(toggleTrainingMode(["review", "exploration"], "exam"), [
    "exam",
  ]);
  assert.deepEqual(toggleTrainingMode(["exam"], "review"), ["review"]);
  assert.deepEqual(toggleTrainingMode(["review"], "exploration"), [
    "exploration",
    "review",
  ]);
  assert.deepEqual(parseModes("invalid"), []);
});
test("exam remains available after full exploration and ignores due dates, failures and difficulty", async () => {
  const engine = await LearningEngine.create();
  for (const [i, word] of words.entries())
    engine.apply({
      id: "learned" + i,
      source: word.source ?? "word",
      word_id: word.id,
      question_type: "meaning",
      result: i % 2 ? "correct" : "incorrect",
      difficulty: word.difficulty,
      answered_at: new Date().toISOString(),
    });
  assert.equal(
    new TrainingPlanner(engine, words, ["meaning"], ["exploration"]).next(),
    null,
  );
  // Stratify the FIRST draw over the whole unit interval: equal-sized bins must
  // select each word equally, irrespective of its memory state or difficulty.
  const counts = new Map<string, number>();
  for (let i = 0; i < 200; i++) {
    const planner = new TrainingPlanner(
      engine,
      words,
      ["meaning"],
      ["exam"],
      () => (i + 0.5) / 200,
    );
    const q = planner.next()!;
    counts.set(q.word.id, (counts.get(q.word.id) ?? 0) + 1);
    assert.equal(q.mode, "exam");
  }
  assert.deepEqual([...counts.values()], Array(10).fill(20));
  const planner = new TrainingPlanner(
    engine,
    words,
    ["meaning"],
    ["exam"],
    () => 0.42,
  );
  for (let set = 0; set < 10; set++) {
    const batch = Array.from({ length: 5 }, () => planner.next()!);
    assert.equal(
      new Set(batch.map((q) => wordKey(q.word.source, q.word.id))).size,
      5,
    );
    assert.ok(batch.every((q) => q.mode === "exam"));
  }
});
test("exam answers retain their mode, update FSRS, leave exploration and enter review", async () => {
  const engine = await LearningEngine.create();
  const planner = new TrainingPlanner(
    engine,
    words,
    ["meaning"],
    ["exam"],
    () => 0.1,
  );
  const q = planner.next()!;
  const session = new TrainingSession();
  const wrong = q.options.findIndex((w) => w.id !== q.word.id);
  const { answer } = session.record(q, wrong, 800, 10000, []);
  assert.equal(answer.mode, "exam");
  assert.equal(answerSchema.safeParse(answer).success, true);
  assert.equal(
    answerSchema.safeParse({ ...answer, mode: "anything" }).success,
    false,
  );
  planner.record(answer, q.word);
  assert.equal(engine.words.size, 1);
  assert.equal([...engine.words.values()][0].last_answer_id, answer.id);
  const review = new TrainingPlanner(engine, words, ["meaning"], ["review"]);
  assert.equal(review.next()!.word.id, q.word.id);
  const exploration = new TrainingPlanner(
    engine,
    words,
    ["meaning"],
    ["exploration"],
  );
  for (let next = exploration.next(); next; next = exploration.next())
    assert.notEqual(next.word.id, q.word.id);
  const correct = session.record(
    q,
    q.options.findIndex((w) => w.id === q.word.id),
    600,
    10000,
    [],
  ).answer;
  assert.equal(answerSchema.safeParse(correct).success, true);
  planner.record(correct, q.word);
  assert.equal([...engine.words.values()][0].last_result, "correct");
  const timeout = session.record(q, null, 10000, 10000, []).answer;
  assert.equal(answerSchema.safeParse(timeout).success, true);
});
test("exam honors question kinds, keeps a small pool usable and reports invalid choices", async () => {
  const engine = await LearningEngine.create();
  const planner = new TrainingPlanner(
    engine,
    words.slice(0, 4),
    ["reading"],
    ["exam"],
    () => 0.5,
  );
  for (let set = 0; set < 3; set++) {
    const batch = Array.from({ length: 4 }, () => planner.next()!);
    assert.equal(new Set(batch.map((q) => q.word.id)).size, 4);
    assert.ok(batch.every((q) => q.kind === "reading"));
  }
  const invalid = new TrainingPlanner(
    engine,
    words.slice(0, 2),
    ["meaning"],
    ["exam"],
  );
  assert.throws(() => invalid.next(), /QUESTION_BUILD_FAILED/);
});
