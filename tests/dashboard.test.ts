import test from "node:test";
import assert from "node:assert/strict";
import { dashboardSummary, percentageShares } from "../lib/dashboard/summary";
import type { DashboardData, DashboardGroup } from "../lib/dashboard/types";
const group = (overrides: Partial<DashboardGroup> = {}): DashboardGroup => ({
  entry_type: "word",
  kind: "meaning",
  level: "1",
  total: 100,
  learned: 3,
  review: 1,
  memory: [1, 1, 1],
  attempts: 10,
  ...overrides,
});
const data: DashboardData = {
  today: "2026-11-03",
  updated_at: "2026-11-03T11:00:00Z",
  groups: [
    group(),
    group({ level: "P", total: 5, learned: 1, memory: [1, 0, 0], attempts: 2 }),
    group({ kind: "reading", learned: 2, memory: [0, 1, 1] }),
    group({ entry_type: "hiragana", total: 104 }),
  ],
  activity: [
    {
      entry_type: "word",
      kind: "meaning",
      level: "1",
      day: "2026-11-03",
      attempts: 4,
      correct: 3,
      timed_correct: 3, correct_ms: 6000,
    },
    {
      entry_type: "word",
      kind: "meaning",
      level: "P",
      day: "2026-10-28",
      attempts: 2,
      correct: 0,
      timed_correct: 0, correct_ms: 0,
    },
    {
      entry_type: "word",
      kind: "reading",
      level: "1",
      day: "2026-11-03",
      attempts: 10,
      correct: 10,
      timed_correct: 8, correct_ms: 10000,
    },
  ],
};
test("scope filters apply consistently and personal words stay separate", () => {
  const result = dashboardSummary(data, "word", "meaning");
  assert.equal(result.learned, 4);
  assert.equal(result.total, 105);
  assert.equal(result.common.learned, 3);
  assert.equal(result.personal.learned, 1);
  assert.deepEqual(result.memory, [2, 1, 1]);
  assert.equal(result.week.attempts, 6);
  assert.equal(result.week.correct, 3);
  assert.equal(result.week.correct_ms, 6000);
  assert.equal(dashboardSummary(data, "word", "reading").week.attempts, 10);
});
test("seven local calendar dates include zero days across a DST transition", () => {
  const result = dashboardSummary(data, "word", "meaning");
  assert.deepEqual(
    result.days.map((d) => d.day),
    [
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ],
  );
  assert.deepEqual(
    result.days.map((d) => d.attempts),
    [2, 0, 0, 0, 0, 0, 4],
  );
});
test("empty selected scope does not erase history in another scope", () => {
  const result = dashboardSummary(data, "katakana", "meaning");
  assert.equal(result.learned, 0);
  assert.equal(result.hasAnyHistory, true);
  assert.equal(result.days.length, 7);
  assert.equal(
    dashboardSummary({ ...data, groups: [], activity: [] }, "word", "meaning")
      .hasAnyHistory,
    false,
  );
});

test("rounded memory percentages total 100 without assigning a share to empty bands", () => {
  assert.equal(
    percentageShares([78, 142, 100]).reduce((a, b) => a + b, 0),
    100,
  );
  assert.deepEqual(percentageShares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(percentageShares([0, 1, 2]), [0, 33, 67]);
  assert.deepEqual(percentageShares([0, 0, 0]), [0, 0, 0]);
});
