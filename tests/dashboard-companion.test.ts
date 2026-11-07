import test from "node:test";
import assert from "node:assert/strict";
import { dashboardSummary } from "../lib/dashboard/summary";
import { companionMessage, visibleCompanionSection } from "../lib/dashboard/companion";
import type { DashboardData } from "../lib/dashboard/types";

const data: DashboardData = {
  today: "2026-11-08", updated_at: "2026-11-08T00:00:00Z",
  groups: [
    { entry_type: "word", kind: "meaning", level: "P", total: 30, learned: 12, review: 4, memory: [7, 3, 2], attempts: 80 },
    { entry_type: "word", kind: "reading", level: "P", total: 30, learned: 25, review: 8, memory: [10, 10, 5], attempts: 900 },
  ],
  activity: [{ entry_type: "word", kind: "meaning", level: "P", day: "2026-11-08", attempts: 9, correct: 5, correct_ms: 4000 }],
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

test("scroll follows a substantially visible card near the reading area", () => {
  assert.equal(visibleCompanionSection([
    { section: "overview", top: -400, bottom: 35 },
    { section: "memory", top: 51, bottom: 450 },
    { section: "activity", top: 466, bottom: 950 },
  ], 800), "memory");
  assert.equal(visibleCompanionSection([{ section: "stages", top: -800, bottom: 1200 }], 800), "stages");
  assert.equal(visibleCompanionSection([{ section: "overview", top: -100, bottom: 30 }], 800), null);
});
