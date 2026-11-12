import test from "node:test";
import assert from "node:assert/strict";
import { queryNotebook, defaultNotebookQuery as defaults } from "../lib/notebook/query";
import type { NotebookWord } from "../lib/notebook/types";
const word = (id: string, changes: Partial<NotebookWord> = {}): NotebookWord => ({ id, source: "word", term: "実装", kana: "じっそう", meaning_ko: "구현", hanja_reading: "실장", note: null, difficulty: 6, last_incorrect_at: "2026-11-01T00:00:00Z", ...changes });
const words = [word("a"), word("b", { term: "テスト", kana: "てすと", meaning_ko: "시험", hanja_reading: null, difficulty: 2, in_personal: true, last_incorrect_at: "2026-11-03T00:00:00Z" }), word("c", { term: "あ", kana: "あ", meaning_ko: "아", hanja_reading: null, difficulty: -1, source: "personal", last_incorrect_at: "2026-11-02T00:00:00Z" })];
test("search matches kana variants, halfwidth, Korean meaning and hanja with AND tokens", () => {
  for (const search of ["ﾃｽﾄ", "テスト", "てすと", "시험"]) assert.deepEqual(queryNotebook(words, { ...defaults, search }).map(w => w.id), ["b"]);
  assert.deepEqual(queryNotebook(words, { ...defaults, search: "実装 구현" }).map(w => w.id), ["a"]);
  assert.equal(queryNotebook(words, { ...defaults, search: "실장" }).length, 1);
  assert.equal(queryNotebook(words, { ...defaults, search: "実装 시험" }).length, 0);
});
test("P membership and stages combine without confusing source and membership", () => {
  assert.deepEqual(queryNotebook(words, { ...defaults, membership: "registered" }).map(w => w.id), ["b", "c"]);
  assert.deepEqual(queryNotebook(words, { ...defaults, membership: "unregistered", stage: "4" }).map(w => w.id), ["a"]);
  assert.deepEqual(queryNotebook(words, { ...defaults, stage: "P" }).map(w => w.id), ["c"]);
  assert.equal(queryNotebook(words, { ...defaults, membership: "registered", stage: "4" }).length, 0);
});
test("all sort orders are deterministic and never reorder source data", () => {
  const expected = { recent: ["b", "c", "a"], oldest: ["a", "c", "b"], reading: ["c", "a", "b"], easy: ["c", "b", "a"], hard: ["a", "b", "c"] } as const;
  for (const sort of Object.keys(expected) as (keyof typeof expected)[]) assert.deepEqual(queryNotebook(words, { ...defaults, sort }).map(w => w.id), expected[sort]);
  assert.deepEqual(words.map(w => w.id), ["a", "b", "c"]);
});

test("stages share homepage ranges and keep kana, personal and membership distinct", () => {
  const entries = Array.from({ length: 11 }, (_, difficulty) => word(String(difficulty), { difficulty, in_personal: true }));
  entries.push(word("h", { difficulty: -1, entry_type: "hiragana" }), word("k", { difficulty: -1, entry_type: "katakana" }), word("p", { source: "personal", difficulty: 0 }), word("p10", { source: "personal", difficulty: 10 }));
  for (const stage of ["1", "2", "3", "4", "5"] as const) {
    assert.deepEqual(queryNotebook(entries, { ...defaults, stage }).map(w => w.difficulty).sort((a,b) => a-b), [(Number(stage)-1)*2, (Number(stage)-1)*2+1]);
  }
  for (const [stage, ids] of [["H", ["h"]], ["K", ["k"]], ["P", ["p", "p10"]]] as const) {
    assert.deepEqual(queryNotebook(entries, { ...defaults, stage }).map(w => w.id).sort(), [...ids]);
  }
});
