import { buildQuestion } from "../lib/game/question";
import type { Word } from "../lib/game/types";
import test from "node:test";
import assert from "node:assert/strict";
import { AnswerGate, keyIndex, limitFor } from "../lib/game/rules";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { LearningEngine } from "../lib/game/learning/engine";
const word = (
  id: number,
  term: string,
  kana: string,
  meaning: string,
  has = true,
): Word => ({
  id: String(id),
  term,
  kana,
  meaning_ko: meaning,
  has_kanji: has,
  hanja_reading: null,
  difficulty: 0,
  note: null,
  deleted_at: null,
  created_at: "",
  updated_at: "",
});
const words = [
  word(1, "秋", "あき", "가을"),
  word(2, "朝", "あさ", "아침"),
  word(3, "明日", "あした", "내일"),
  word(4, "あさって", "あさって", "모레", false),
  word(5, "コミュニケーション", "コミュニケーション", "의사소통", false),
  word(6, "あす", "あす", "내일", false),
];

test("lean catalog entries preserve gameplay without audit fields or recent-20 statistics", async () => {
  const lean: Word[] = words.map((w) => ({
    id: w.id,
    term: w.term,
    kana: w.kana,
    meaning_ko: w.meaning_ko,
    hanja_reading: w.hanja_reading,
    has_kanji: w.has_kanji,
    difficulty: w.difficulty,
    entry_type: w.entry_type,
    deleted_at: w.deleted_at,
  }));
  const planner = new TrainingPlanner(
    await LearningEngine.create(),
    lean,
    ["meaning"],
    ["exploration"],
    () => 0.4,
  );
  assert.equal(planner.hasQuestions(), true);
  const question = planner.next()!;
  assert.equal(question.options.length, 4);
  assert.ok(question.options.some((w) => w.id === question.word.id));
  assert.equal(question.word.note, undefined);
});
test("time progression is integer ms and clamps at 2 seconds", () => {
  assert.equal(limitFor(0), 10000);
  assert.equal(limitFor(1), 9800);
  assert.equal(limitFor(39), 2200);
  assert.equal(limitFor(40), 2000);
  assert.equal(limitFor(400), 2000);
});
test("top row and numpad use numeric values", () => {
  for (let i = 1; i <= 4; i++) {
    assert.equal(keyIndex("Digit" + i), i - 1);
    assert.equal(keyIndex("Numpad" + i), i - 1);
  }
  assert.equal(keyIndex("Digit5"), null);
});
test("a down event claims a question once; repeated and simultaneous inputs stay locked", () => {
  const gate = new AnswerGate();
  gate.open();
  assert.ok(gate.claim("Digit1", 0));
  assert.equal(gate.claim("Digit1", 0), false);
  assert.equal(gate.claim("p1", 1), false);
  gate.cancel();
  assert.equal(gate.claim("Digit2", 1), false);
  gate.open();
  assert.ok(gate.claim("p2", 2));
  gate.close();
  assert.equal(gate.claim("Digit3", 2), false);
});

test("questions contain one correct answer, disjoint choices, no kana-only reading quizzes or immediate repeats", () => {
  let previous = "";
  let reads = 0;
  for (let n = 0; n < 1000; n++) {
    const q = buildQuestion(words, [], previous);
    assert.notEqual(q.word.id, previous);
    assert.equal(q.options.length, 4);
    assert.equal(q.options.filter((w) => w.id === q.word.id).length, 1);
    assert.equal(
      new Set(
        q.options.map((w) => (q.kind === "reading" ? w.kana : w.meaning_ko)),
      ).size,
      4,
    );
    if (q.kind === "reading") {
      reads++;
      assert.ok(q.word.has_kanji);
    }
    previous = q.word.id;
  }
  assert.ok(reads > 0);
});
test("insufficient distinct choices fail explicitly", () => {
  assert.throws(() => buildQuestion(words.slice(0, 3), []), /NOT_ENOUGH/);
});
