import test from "node:test";
import assert from "node:assert/strict";
import { buildReadingIndex, normalizedReading, readingDistance, readingSignature, searchReadings } from "../lib/game/reading-index";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { LearningEngine } from "../lib/game/learning/engine";
import { questionFor } from "../lib/game/question";
import type { Word } from "../lib/game/types";
import { ReadingSearch } from "../lib/game/data/reading-search";

function readings() {
  let seed = 123;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const chars = [..."あいうえおかきくけこさしすせそたちつてとなにぬねの"];
  return Array.from({ length: 700 }, () => Array.from({ length: 1 + Math.floor(random() * 9) }, () => chars[Math.floor(random() * chars.length)]).join(""));
}
test("length-bucket BK search matches exhaustive weighted edit-distance ranking", () => {
  const values = readings(), index = buildReadingIndex(values);
  const unique = [...new Set(values.map(normalizedReading))];
  for (const target of values.filter((_, i) => i % 13 === 0)) {
    const expected = unique.filter(x => x !== target).map(x => ({ x, score: readingDistance(target, x) + Math.abs(target.length - x.length) * 0.25 }))
      .sort((a, b) => a.score - b.score || (a.x < b.x ? -1 : a.x > b.x ? 1 : 0)).slice(0, 20).map(x => x.x);
    assert.deepEqual(searchReadings([index], target), expected);
  }
});
test("common and owner-specific indexes merge, persist and invalidate by complete reading content", () => {
  const common = ["ほじ", "ホジ", "いじ", "ほし"], personal = ["ほじょ", "ほうじ", "こじ"];
  const a = buildReadingIndex(common), b = buildReadingIndex(personal);
  assert.equal(a.total, 3);
  assert.deepEqual(searchReadings([a, JSON.parse(JSON.stringify(b))], "ホジ"), searchReadings([buildReadingIndex([...common, ...personal])], "ほじ"));
  assert.equal(readingSignature(common), readingSignature([...common].reverse()));
  assert.equal(readingSignature(common), readingSignature([...common, " ほじ "]));
  assert.notEqual(readingSignature(personal), readingSignature(personal.slice(1)));
  const updated = buildReadingIndex(["ほじょ", "しじ"]);
  assert.ok(!searchReadings([a, updated], "ほじ").includes("こじ"));
  assert.deepEqual(searchReadings([buildReadingIndex(["ホジ"])], "ほじ"), []);
  assert.deepEqual(searchReadings([buildReadingIndex([])], "ほじ"), []);
});
const words = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), term: "検証" + i, kana: "けんしょう" + i,
  meaning_ko: "뜻" + i, hanja_reading: null, has_kanji: true, difficulty: 5, deleted_at: null, source: "personal" } as Word));
test("async planning prepares only the selected five reading questions, never all 1000 P entries", async () => {
  let prepared = 0;
  const planner = new TrainingPlanner(await LearningEngine.create(), words.map(w => ({ ...w })), ["reading"], ["exam"], () => 0.25,
    async (word, kind) => { assert.equal(kind, "reading"); prepared++; word.reading_choices = words.filter(x => x.id !== word.id).slice(0, 5); });
  await Promise.all([planner.prepareSet(), planner.prepareSet()]);
  assert.equal(prepared, 5);
  assert.equal(planner.hasQuestions(), true);
  for (let i = 0; i < 5; i++) {
    const q = planner.next()!;
    assert.equal(q.word.source, "personal");
    assert.equal(q.kind, "reading");
    assert.equal(q.options.length, 4);
  }
  await planner.prepareSet();
  assert.equal(prepared, 10);
});
test("P meaning retains its existing choices and reading can borrow unselected common words", async () => {
  const p = { ...words[100], reading_choices: words.slice(0, 5).map(w => ({ ...w, source: undefined })) };
  const reading = questionFor(p, "reading", [p], () => 0.3)!;
  assert.ok(reading.options.some(x => x.id !== p.id));
  const meaning = questionFor(p, "meaning", words, () => 0.3)!;
  assert.ok(meaning);
  assert.equal(meaning.options.filter(x => x.id === p.id).length, 1);
});
test("resetting a pending preparation discards its old set and preserves the new generation", async () => {
  let release!: () => void, calls = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const planner = new TrainingPlanner(await LearningEngine.create(), words.slice(0, 20).map(w => ({ ...w })), ["reading"], ["exam"], () => 0.4,
    async word => { if (++calls === 1) await held; word.reading_choices = words.filter(w => w.id !== word.id).slice(0, 5); });
  const first = planner.prepareSet();
  planner.resetSet();
  const second = planner.prepareSet(); release();
  await Promise.all([first, second]);
  assert.equal(calls, 6);
  assert.equal(planner.hasQuestions(), true);
});

test("Worker-less fallback stays indexed, skips deleted words and does not precompute targets", async () => {
  const target: Word = { ...words[100], reading_choices: undefined };
  const catalog = [...words.slice(0, 40).map(w => ({ ...w, source: undefined })),
    { ...words[99], deleted_at: "2026-11-08" }, target];
  const search = new ReadingSearch();
  await search.initialize(catalog, "owner");
  await search.prepare(target);
  assert.equal(target.reading_choices!.length, 20);
  assert.ok(target.reading_choices!.every(w => w.source !== "personal"));
  assert.ok(!target.reading_choices!.some(w => w.id === words[99].id));
  assert.equal(catalog[0].reading_choices, undefined);
  search.close();
  await assert.rejects(search.prepare({ ...words[200] }), /CLOSED/);
});
