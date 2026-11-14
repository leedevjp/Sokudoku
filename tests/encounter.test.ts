import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../lib/game/learning/engine";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { encounterLabel } from "../lib/game/encounter";
import type { Word } from "../lib/game/types";

const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i), term: `term${i}`, kana: `かな${i}`, meaning_ko: `meaning${i}`,
  hanja_reading: null, has_kanji: true, difficulty: 0, deleted_at: null,
}));

test("encounters combine saved reading and meaning answers, keeping personal history separate", async () => {
  const engine = await LearningEngine.create();
  for (const word of words) {
    for (const [i, kind] of (["meaning", "reading", "meaning"] as const).entries())
      engine.apply({ id: `${word.id}-${i}`, word_id: word.id, source: "word",
        question_type: kind, result: i === 0 ? "incorrect" : "correct", difficulty: 0,
        answered_at: new Date(1794000000000 + i * 1000).toISOString() });
    engine.apply({ id: `p-${word.id}`, word_id: word.id, source: "personal",
      question_type: "meaning", result: "timeout", difficulty: 0,
      answered_at: new Date(1794000000000).toISOString() });
  }
  const restored = await LearningEngine.create(engine.snapshot());
  const common = new TrainingPlanner(restored, words, ["meaning"], ["exam"], () => 0.4);
  assert.equal(common.next()!.encounterCount, 4);
  const personal = new TrainingPlanner(restored, words.map(w => ({ ...w, source: "personal" })), ["meaning"], ["exam"], () => 0.4);
  assert.equal(personal.next()!.encounterCount, 2);
});

test("prepared questions do not count; repeated displays and retries do, without double counting answers", async () => {
  const planner = new TrainingPlanner(await LearningEngine.create(), words, ["meaning"], ["exam"], () => 0.4);
  assert.equal(planner.hasQuestions(), true);
  await planner.prepareSet();
  const first = planner.next()!;
  assert.equal(first.encounterCount, 1);
  planner.record({ id: "answer", word_id: first.word.id, question_type: first.kind,
    result: "correct", selected_word_id: first.word.id, response_ms: 200,
    time_limit_ms: 10000, answered_at: new Date().toISOString(), mode: "exam" }, first.word);
  // Rendering the answered question again must retain its original badge.
  assert.equal(first.encounterCount, 1);
  planner.resetSet();
  const repeated = planner.next()!;
  assert.equal(repeated.word.id, first.word.id);
  assert.equal(repeated.encounterCount, 2);
  planner.resetSet();
  assert.equal(planner.next()!.encounterCount, 3);
});

test("encounter labels support Korean and Japanese", () => {
  assert.equal(encounterLabel(1, "kr"), "첫 만남");
  assert.equal(encounterLabel(12, "kr"), "12번째 만남");
  assert.equal(encounterLabel(1, "jp"), "初めての出会い");
  assert.equal(encounterLabel(1200, "jp"), "1200回目の出会い");
});
