import test from "node:test";
import assert from "node:assert/strict";
import { dashboardSummary } from "../lib/dashboard/summary";
import { companionFocusKey, companionMessage, visibleCompanionSection, type CompanionFocus } from "../lib/dashboard/companion";
import { companionLines } from "../lib/dashboard/companion-lines";
import type { DashboardData } from "../lib/dashboard/types";

const data: DashboardData = {
  today: "2026-11-08", updated_at: "2026-11-08T00:00:00Z",
  groups: [
    { entry_type: "word", kind: "meaning", level: "P", total: 30, learned: 12, review: 4, memory: [7, 3, 2], attempts: 80 },
    { entry_type: "word", kind: "reading", level: "P", total: 30, learned: 25, review: 8, memory: [10, 10, 5], attempts: 900 },
  ],
  activity: [{ entry_type: "word", kind: "meaning", level: "P", day: "2026-11-08", attempts: 9, correct: 5, timed_correct: 5, correct_ms: 4000 }],
};
const summary = dashboardSummary(data, "word", "meaning");

test("encouragement follows selected scope, day, memory band and stage", () => {
  assert.match(companionMessage(summary, { section: "overview" }, "kr"), /80번/);
  assert.match(companionMessage(summary, { section: "memory" }, "kr"), /5개/);
  assert.match(companionMessage(summary, { section: "memory", band: 0 }, "kr"), /7개/);
  assert.match(companionMessage(summary, { section: "stages", level: "P" }, "kr"), /내 단어에서 12개/);
  assert.match(companionMessage(summary, { section: "activity", day: "2026-11-08" }, "jp"), /9問/);
  assert.match(companionMessage(summary, { section: "activity", day: "2026-11-07" }, "kr"), /쉬어간 날/);
  assert.notEqual(companionMessage(summary, { section: "memory" }, "kr", 1), companionMessage(summary, { section: "memory" }, "kr"));
});

test("empty history gets encouragement without invented achievements", () => {
  const empty = dashboardSummary({ ...data, groups: [], activity: [] }, "word", "meaning");
  assert.match(companionMessage(empty, { section: "overview" }, "kr"), /첫 번째/);
  assert.match(companionMessage(empty, { section: "memory", band: 2 }, "kr"), /시작 전/);
  assert.match(companionMessage(empty, { section: "activity" }, "kr"), /반가워/);
});

test("every context offers a full non-repeating bilingual cycle", () => {
  const empty = dashboardSummary({ ...data, groups: [], activity: [] }, "word", "meaning");
  const cases: [typeof summary, CompanionFocus][] = [
    [summary, { section: "overview" }], [empty, { section: "overview" }],
    [summary, { section: "memory" }],
    ...[0, 1, 2].map(band => [summary, { section: "memory", band }] as [typeof summary, CompanionFocus]),
    [empty, { section: "memory", band: 0 }], [summary, { section: "activity" }],
    [summary, { section: "activity", day: "2026-11-07" }], [empty, { section: "activity" }],
    [summary, { section: "stages" }], [summary, { section: "stages", level: "P" }],
    [summary, { section: "activity", day: "2026-11-08", topic: "dayDetail" }],
    [summary, { section: "overview", topic: "total" }],
  ];
  for (const [scope, focus] of cases) for (const lang of ["kr", "jp"]) {
    const first = companionMessage(scope, focus, lang);
    const lines = [first];
    let length = 1;
    for (; length <= 100; length++) {
      const next = companionMessage(scope, focus, lang, length);
      if (next === first) break;
      assert.ok(!lines.includes(next), `premature duplicate: ${JSON.stringify({ focus, lang, next })}`);
      lines.push(next);
    }
    assert.ok(length >= companionLines[focus.section].length && length <= 100, "a complete bounded cycle must include the section's variety");
    for (let i = 0; i < length; i++) {
      assert.equal(companionMessage(scope, focus, lang, length + i), lines[i]);
      assert.equal(companionMessage(scope, focus, lang, i - length), lines[i]);
    }
  }
  const all = Object.values(companionLines).flat();
  for (const index of [0, 1]) {
    assert.equal(new Set(all.map(pair => pair[index])).size, all.length);
    assert.ok(all.every(pair => pair[index].length > 0 && pair[index].length <= 90));
  }
});

test("visiting different dates, bands and stages retains independent cursors", () => {
  const focuses: CompanionFocus[] = [
    { section: "overview" }, { section: "memory" }, { section: "memory", band: 0 },
    { section: "memory", band: 1 }, { section: "activity", day: "2026-11-07" },
    { section: "activity", day: "2026-11-08" }, { section: "stages", level: "P" },
    { section: "stages", level: "1" },
  ];
  assert.equal(new Set(focuses.map(companionFocusKey)).size, focuses.length);
});

test("scroll follows a substantially visible card near the reading area", () => {
  assert.equal(visibleCompanionSection([
    { section: "overview", top: -400, bottom: 35 },
    { section: "memory", top: 51, bottom: 450 },
    { section: "activity", top: 466, bottom: 950 },
  ], 800), "memory");
  assert.equal(visibleCompanionSection([{ section: "stages", top: -800, bottom: 1200 }], 800), "stages");
  assert.equal(visibleCompanionSection([{ section: "overview", top: -100, bottom: 30 }], 800), null);
});

test("historical day counts never borrow current-day or weekly achievements", () => {
  const scoped = dashboardSummary({ ...data, activity: [
    ...data.activity,
    { ...data.activity[0], day: "2026-11-07", attempts: 3, correct: 2 },
  ] }, "word", "meaning");
  for (const topic of [undefined, "dayDetail"]) {
    assert.match(companionMessage(scoped, { section: "activity", day: "2026-11-07", topic }, "kr"), /3문제/);
    assert.match(companionMessage(scoped, { section: "activity", day: "2026-11-07", topic }, "jp"), /3問/);
    for (let i = 0; i < 20; i++) {
      const text = companionMessage(scoped, { section: "activity", day: "2026-11-07", topic }, "kr", i);
      assert.doesNotMatch(text, /오늘도 많이|오늘 공부한|9문제|12문제/);
    }
  }
  assert.match(companionMessage(scoped, { section: "activity", day: "2026-11-06", topic: "dayDetail" }, "kr"), /쉬어간 날/);
  assert.match(companionMessage(scoped, { section: "activity", day: "2020-01-01", topic: "dayDetail" }, "kr"), /시작 전/);
});
test("total vocabulary and learned counts remain distinct", () => {
  assert.match(companionMessage(summary, { section: "overview", topic: "total" }, "kr"), /전체 30개/);
  assert.match(companionMessage(summary, { section: "overview", topic: "learned" }, "kr"), /12개/);
});

test("overview celebrates repeated answers in the selected scope rather than distinct words", () => {
  const repeated = dashboardSummary({ ...data, groups: [
    { ...data.groups[0], learned: 2261, attempts: 4020 }, data.groups[1],
  ] }, "word", "meaning");
  for (const topic of [undefined, "attempts"]) {
    assert.equal(companionMessage(repeated, { section: "overview", topic }, "kr"), "벌써 4,020번이나 답했네! 굉장해!");
    assert.match(companionMessage(repeated, { section: "overview", topic }, "jp"), /4,020回/);
  }
  const reading = dashboardSummary(data, "word", "reading");
  assert.match(companionMessage(reading, { section: "overview" }, "kr"), /900번/);
});
