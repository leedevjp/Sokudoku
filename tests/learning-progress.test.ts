import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../lib/game/learning/engine";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { recoverLearning } from "../lib/game/learning/recovery";
import { TrainingSession } from "../lib/game/session";
import type { Answer, Word } from "../lib/game/types";

const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i), term: `term${i}`, kana: `かな${i}`, meaning_ko: `meaning${i}`,
  hanja_reading: null, has_kanji: true, difficulty: 0, deleted_at: null,
}));
const answer = (id: string, wordId: string, at = "2026-11-05T00:00:00Z"): Answer => ({
  id, word_id: wordId, question_type: "meaning", selected_word_id: wordId,
  result: "correct", response_ms: 500, time_limit_ms: 10000, answered_at: at,
  mode: "exploration",
});

test("exhausted exploration completes normally and exposes remaining review timing", async () => {
  const engine = await LearningEngine.create();
  const planner = new TrainingPlanner(engine, words, ["meaning"], ["exploration"], () => 0.4);
  for (let i = 0; i < words.length; i++) {
    const q = planner.next()!;
    planner.record(answer(`a${i}`, q.word.id, new Date().toISOString()), q.word);
  }
  assert.equal(planner.next(), null);
  assert.equal(planner.hasQuestions(), false);
  assert.equal(planner.progress().unseen, 0);
  assert.equal(planner.progress().review, 0);
  assert.ok(planner.progress().nextDue! > Date.now());
});

test("unbuildable choices are not reported as cleared", async () => {
  const pool = words.map(w => ({ ...w, meaning_ko: "same meaning" }));
  const planner = new TrainingPlanner(await LearningEngine.create(), pool, ["meaning"], ["exploration"]);
  assert.throws(() => planner.hasQuestions(), /QUESTION_BUILD_FAILED/);
  assert.equal(planner.progress().unseen, 8);
});

test("review-only with no due cards is normal even when exploration remains", async () => {
  const planner = new TrainingPlanner(await LearningEngine.create(), words, ["meaning"], ["review"]);
  assert.equal(planner.next(), null);
  assert.equal(planner.progress().unseen, 8);
  assert.equal(planner.progress().review, 0);
});

test("progress counts review words once across reading and meaning", async () => {
  const engine = await LearningEngine.create();
  for (const kind of ["meaning", "reading"] as const)
    engine.apply({ ...answer(kind, "0"), source: "word", difficulty: 0, question_type: kind, result: "incorrect" });
  const planner = new TrainingPlanner(engine, words);
  assert.equal(planner.progress().review, 1);
  assert.equal(planner.progress().unseen, 7);
});

test("recovery replays local answers before exploration and ignores acknowledged duplicates", async () => {
  const pending = [answer("001", "0")];
  const recovered = await recoverLearning(undefined, pending, words);
  assert.equal(recovered.words.size, 1);
  const planner = new TrainingPlanner(recovered, words, ["meaning"], ["exploration"]);
  assert.equal(planner.progress().unseen, 7);
  const replayed = await recoverLearning(recovered.snapshot(), pending, words);
  assert.equal(replayed.learner.review_count, 1);
  assert.deepEqual(replayed.snapshot(), recovered.snapshot());
});

test("recovery keeps newer canonical states and separates personal ownership scope", async () => {
  const engine = await recoverLearning(undefined, [answer("002", "0", "2026-11-05T01:00:00Z")], words);
  const snapshot = engine.snapshot();
  const recovered = await recoverLearning(snapshot, [answer("001", "0")], words);
  assert.deepEqual(recovered.snapshot(), snapshot);
  const personal = words.map(w => ({ ...w, source: "personal" as const }));
  const privateEngine = await recoverLearning(undefined, [{ ...answer("003", "0"), source: "personal" }], personal);
  assert.equal(privateEngine.words.get("personal:0:meaning")?.source, "personal");
});

test("equal-time queued answers cannot replace a newer canonical answer ID", async () => {
  const engine = await recoverLearning(undefined, [answer("002", "0")], words);
  const snapshot = engine.snapshot();
  snapshot.words[0].last_review_at = "2026-11-05T00:00:00+00:00";
  const recovered = await recoverLearning(snapshot, [answer("001", "0")], words);
  assert.deepEqual(recovered.snapshot(), snapshot);
});

test("session preserves selection mode for correct answers and timeouts", () => {
  const session = new TrainingSession();
  const q = { word: words[0], kind: "meaning" as const, options: words.slice(0, 4), mode: "exploration" as const };
  assert.equal(session.record(q, 0, 500, 10000, []).answer.mode, "exploration");
  assert.equal(session.record({ ...q, mode: "review" }, null, 10000, 10000, []).answer.mode, "review");
});
