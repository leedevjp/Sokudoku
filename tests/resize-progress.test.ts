import test from "node:test";
import assert from "node:assert/strict";
import { resizeProgress } from "../lib/game/phaser/resize-progress";
const initial = {
  phase: "arming" as const,
  beforePause: "play" as const,
  afterSettle: "play" as const,
  started: 0,
  pauseAt: 0,
  resizeElapsed: 0,
  settleElapsed: 0,
};
test("initial viewport changes neither request a pause nor consume page-uptime as answer time", () => {
  assert.deepEqual(resizeProgress(initial, 90000, 10000), {
    paused: false,
    resolved: false,
    elapsed: 0,
  });
});
test("active viewport changes preserve answer time and remain active", () => {
  assert.deepEqual(
    resizeProgress({ ...initial, phase: "play", started: 90000 }, 92500, 10000),
    { paused: false, resolved: false, elapsed: 2500 },
  );
  assert.equal(
    resizeProgress(
      { ...initial, phase: "settling", settleElapsed: 2500 },
      99999,
      10000,
    ).elapsed,
    2500,
  );
});
test("a real pause stays paused and resizing does not count paused time", () => {
  assert.deepEqual(
    resizeProgress(
      { ...initial, phase: "paused", started: 90000, pauseAt: 92500 },
      99999,
      10000,
    ),
    { paused: true, resolved: false, elapsed: 2500 },
  );
  assert.equal(
    resizeProgress(
      {
        ...initial,
        phase: "paused",
        beforePause: "arming",
        resizeElapsed: 2500,
      },
      99999,
      10000,
    ).elapsed,
    2500,
  );
});
test("resolved answers advance without carrying their old timer into the next question", () => {
  assert.deepEqual(
    resizeProgress(
      { ...initial, phase: "feedback", started: 90000 },
      92500,
      10000,
    ),
    { paused: false, resolved: true, elapsed: 0 },
  );
  assert.deepEqual(
    resizeProgress(
      { ...initial, phase: "paused", beforePause: "flight" },
      92500,
      10000,
    ),
    { paused: true, resolved: true, elapsed: 0 },
  );
});
