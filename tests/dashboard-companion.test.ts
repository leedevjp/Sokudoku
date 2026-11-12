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
  assert.match(companionMessage(summary, { section: "overview" }, "kr"), /9문제/);
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
  assert.match(companionMessage(empty, { section: "memory", band: 2 }, "kr"), /비어 있어/);
  assert.match(companionMessage(empty, { section: "activity" }, "kr"), /반가워/);
});

test("every context offers a full non-repeating bilingual cycle", () => {
  const empty = dashboardSummary({ ...data, groups: [], activity: [] }, "word", "meaning");
  const cases: [typeof summary, CompanionFocus, number][] = [
    [summary, { section: "overview" }, 11],
    [empty, { section: "overview" }, 17],
    [summary, { section: "memory" }, 11],
    ...[0, 1, 2].map(band => [summary, { section: "memory", band }, 16] as [typeof summary, CompanionFocus, number]),
    [empty, { section: "memory", band: 0 }, 11],
    [summary, { section: "activity" }, 11],
    [summary, { section: "activity", day: "2026-11-07" }, 17],
    [empty, { section: "activity" }, 17],
    [summary, { section: "stages" }, 11],
    [summary, { section: "stages", level: "P" }, 17],
  ];
  for (const [scope, focus, length] of cases) for (const lang of ["kr", "jp"]) {
    const lines = Array.from({ length }, (_, i) => companionMessage(scope, focus, lang, i));
    assert.equal(new Set(lines).size, length, JSON.stringify({ focus, lang }));
    assert.equal(companionMessage(scope, focus, lang, length), lines[0]);
    assert.notEqual(lines.at(-1), lines[0]);
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
