import test from "node:test";
import assert from "node:assert/strict";
import { Correction, correctionContent } from "../lib/game/correction";
import type { Question, Word } from "../lib/game/types";

const word: Word = {
  id: "word",
  term: "実装",
  kana: "じっそう",
  hanja_reading: "실장",
  meaning_ko: "구현",
  has_kanji: true,
  difficulty: 6,
  entry_type: "word",
  deleted_at: null,
};
const question: Question = {
  word,
  kind: "meaning",
  options: [
    { ...word, id: "a" },
    { ...word, id: "b" },
    word,
    { ...word, id: "c" },
  ],
};

test("correction uses the original answer number and current question type first", () => {
  assert.deepEqual(correctionContent(question), {
    index: 2,
    readingHint: "じっそう",
    primary: "실장(구현)",
    secondary: "じっそう",
  });
  assert.deepEqual(correctionContent({ ...question, kind: "reading" }), {
    index: 2,
    readingHint: "じっそう",
    primary: "じっそう",
    secondary: "실장(구현)",
  });
});
test("kana corrections keep the Korean answer separate from the reading hint", () => {
  for (const entry_type of ["hiragana", "katakana"] as const) {
    const kana: Word = {
      ...word,
      term: entry_type === "hiragana" ? "じょ" : "ジョ",
      kana: "じょ",
      hanja_reading: null,
      meaning_ko: "조",
      has_kanji: false,
      difficulty: -1,
      entry_type,
    };
    assert.deepEqual(
      correctionContent({ word: kana, kind: "meaning", options: [kana] }),
      { index: 0, primary: "조", readingHint: "じょ", secondary: null },
    );
  }
});
test("two seconds count only while running and replay resumes the remainder", () => {
  const correction = new Correction(question);
  assert.equal(correction.tick(750), false);
  assert.equal(correction.ratio, 0.625);
  correction.toggle();
  assert.equal(correction.tick(60000), false);
  assert.equal(correction.ratio, 0.625);
  correction.toggle();
  assert.equal(correction.tick(1249), false);
  assert.equal(correction.tick(1), true);
  assert.equal(correction.complete(), true);
  assert.equal(correction.complete(), false);
  assert.equal(correction.tick(3000), false);
});
test("only the correct number or a card tap can complete, including during local pause", () => {
  const correction = new Correction(question);
  correction.toggle();
  assert.equal(correction.complete(1), false);
  assert.equal(correction.complete(2), true);
  assert.equal(correction.complete(2), false);
  const tap = new Correction(question);
  assert.equal(tap.complete(), true);
  assert.equal(tap.tick(2000), false);
});

test("reading hints normalize katakana and preserve optional Korean pronunciation", () => {
  const hint = (kana: string, pronunciation_ko?: string | null) => correctionContent({ ...question, word: { ...word, kana, pronunciation_ko } }).readingHint;
  assert.equal(hint(" ジッソウ ", " 짓소우 "), "じっそう [짓소우]");
  assert.equal(hint("じっそう", null), "じっそう");
  assert.equal(hint("じっそう", "  "), "じっそう");
  assert.equal(hint("  ", "짓소우"), null);
});
