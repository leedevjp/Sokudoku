import test from "node:test";
import assert from "node:assert/strict";
import { withMeaningBank, type MeaningBank } from "../lib/game/meaning-bank";
import { questionFor } from "../lib/game/question";
import { TrainingSession } from "../lib/game/session";
import { answerSchema } from "../lib/game/answer-schema";
import { nearbyReadings } from "../lib/game/reading-choices";
import type { Word } from "../lib/game/types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const word: Word = { id: id(1), term: "持参", kana: "じさん", meaning_ko: "지참",
  hanja_reading: "지참", has_kanji: true, difficulty: 0, deleted_at: null };
const labels = ["지급", "지출", "지시", "지정", "지속", "지지", "지연", "지명"];
const bank: MeaningBank = { [word.id]: labels.map((label, i) => ["extra", id(i + 10), label, null]) };
function rng(seed = 12345) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

test("a one-word stage draws only its bank and varies both distractors and answer positions", () => {
  const [target] = withMeaningBank([word], bank), random = rng();
  const combinations = new Set(), positions = new Set();
  for (let i = 0; i < 60; i++) {
    const question = questionFor(target, "meaning", [target], random)!;
    assert.ok(question);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(x => x.id)).size, 4);
    positions.add(question.options.findIndex(x => x.id === target.id));
    const wrong = question.options.filter(x => x.id !== target.id);
    wrong.forEach(x => { assert.equal(x.source, "extra"); assert.ok(labels.includes(x.meaning_ko)); });
    combinations.add(wrong.map(x => x.id).sort().join(","));
  }
  assert.ok(combinations.size > 15);
  assert.equal(positions.size, 4);
  assert.equal(word.meaning_choices, undefined);
});

test("missing banks fail for released common words; personal and kana stay independent", () => {
  assert.throws(() => withMeaningBank([word], {}), /MEANING_BANK/);
  const personal = { ...word, source: "personal" as const };
  const kana = { ...word, entry_type: "hiragana" as const, difficulty: -1 };
  assert.deepEqual(withMeaningBank([personal, kana], {}), [personal, kana]);
});

test("an extra click is an incorrect meaning answer with its own selection source", () => {
  const [target] = withMeaningBank([word], bank);
  const question = questionFor(target, "meaning", [target], rng())!;
  const index = question.options.findIndex(x => x.source === "extra");
  const { answer } = new TrainingSession().record(question, index, 500, 10000, []);
  assert.equal(answer.result, "incorrect");
  assert.equal(answer.selected_source, "extra");
  assert.equal(answer.word_id, target.id);
  assert.equal(answerSchema.safeParse(answer).success, true);
  assert.equal(answerSchema.safeParse({ ...answer, question_type: "reading" }).success, false);
  assert.equal(answerSchema.safeParse({ ...answer, result: "correct", selected_word_id: word.id }).success, false);
});

test("reading candidates exclude homophones across scripts and prefer close readings", () => {
  const pool = [word, ...["ジサン", "じかん", "じしん", "しさん", "あいうえおかきくけこ"].map((kana, i) => ({ ...word, id: id(i + 40), kana }))];
  const candidates = nearbyReadings(word, pool);
  assert.equal(candidates.some(x => x.kana === "ジサン"), false);
  assert.ok(["じかん", "じしん", "しさん"].includes(candidates[0].kana));
  const question = questionFor(word, "reading", pool, rng())!;
  assert.equal(question.options.length, 4);
  assert.equal(question.options.some(x => x.kana === "ジサン"), false);
});
