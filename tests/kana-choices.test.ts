import test from "node:test";
import assert from "node:assert/strict";
import { questionFor } from "../lib/game/question";
import type { Word } from "../lib/game/types";

function catalog(type: "hiragana" | "katakana") {
  const rows = [
    ["まみむめも", "마미무메모"], ["なにぬねの", "나니누네노"],
    ["さしすせそ", "사시스세소"], ["らりるれろ", "라리루레로"],
  ];
  const words: Word[] = [];
  function add(term: string, label: string) {
    if (type === "katakana") term = [...term].map(c => String.fromCharCode(c.charCodeAt(0) + 0x60)).join("");
    words.push({ id: type + term, term, kana: term, meaning_ko: label,
      entry_type: type, has_kanji: false, hanja_reading: null,
      difficulty: -1, deleted_at: null } as Word);
  }
  for (const [kana, labels] of rows) [...kana].forEach((c, i) => add(c, labels[i]));
  for (const [head, labels] of [["み", "먀뮤묘"], ["に", "냐뉴뇨"], ["り", "랴류료"]])
    [..."ゃゅょ"].forEach((tail, i) => add(head + tail, labels[i]));
  return words;
}
const key = (words: Word[]) => words.map(w => w.meaning_ko).sort().join("|");
for (const type of ["hiragana", "katakana"] as const) {
  test(type + ": balanced dynamic choices keep basic and yoon pools separate", () => {
    const pool = catalog(type);
    for (const label of ["미", "묘"]) {
      const target = pool.find(w => w.meaning_ko === label)!;
      const combinations = new Set<string>();
      for (let i = 0; i < 8; i++) {
        // Even identical RNG draws must not repeat recent available combinations.
        const q = questionFor(target, "meaning", pool, () => 0.4)!;
        assert.ok(q);
        assert.equal(q.options.filter(w => w.id === target.id).length, 1);
        assert.equal(new Set(q.options.map(w => w.id)).size, 4);
        const rows = new Map<number, number>(), vowels = new Map<number, number>();
        for (const w of q.options) {
          const n = w.meaning_ko.charCodeAt(0) - 0xac00;
          const row = Math.floor(n / 588), vowel = Math.floor(n / 28) % 21;
          rows.set(row, (rows.get(row) ?? 0) + 1);
          vowels.set(vowel, (vowels.get(vowel) ?? 0) + 1);
          assert.equal([2,12,17].includes(vowel), label === "묘");
          assert.equal(w.entry_type, type);
        }
        assert.deepEqual([...rows.values()], [2,2]);
        assert.deepEqual([...vowels.values()], [2,2]);
        combinations.add(key(q.options));
      }
      assert.equal(combinations.size, label === "미" ? 8 : 4);
    }
  });
}
test("incomplete kana pools cannot silently produce unbalanced choices", () => {
  const pool = catalog("hiragana");
  const target = pool.find(w => w.meaning_ko === "묘")!;
  assert.equal(questionFor(target, "meaning", pool.filter(w => ["묘","미","무","메"].includes(w.meaning_ko)), () => 0.5), null);
});
