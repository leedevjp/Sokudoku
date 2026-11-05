import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARGE_MS,
  HIT_STOP_MS,
  chargeProgress,
  knockbackProgress,
} from "../lib/game/battle-timing";
import { CORRECT_FEEDBACK_MS } from "../lib/game/rules";
test("charge accelerates into contact and keeps answer cadence below half a second", () => {
  assert.equal(chargeProgress(-10), 0);
  assert.equal(chargeProgress(20), 0);
  assert.ok(
    chargeProgress(120) - chargeProgress(100) >
      chargeProgress(60) - chargeProgress(40),
  );
  assert.equal(chargeProgress(CHARGE_MS), 1);
  assert.equal(chargeProgress(10000), 1);
  assert.ok(CHARGE_MS + CORRECT_FEEDBACK_MS <= 500);
});
test("contact freezes before the slime is knocked away, then settles monotonically", () => {
  assert.equal(knockbackProgress(0), 0);
  assert.equal(knockbackProgress(HIT_STOP_MS), 0);
  assert.ok(knockbackProgress(HIT_STOP_MS + 16) > 0);
  let previous = 0;
  for (let t = 0; t < 400; t++) {
    const current = knockbackProgress(t);
    assert.ok(current >= previous && current <= 1);
    previous = current;
  }
  assert.equal(previous, 1);
});
import { dodgePose, stumblePose } from "../lib/game/battle-timing";
test("dodge clears the charge lane before contact and lands inside reserved space", () => {
  assert.ok(dodgePose(CHARGE_MS).y < -50);
  assert.ok(dodgePose(CHARGE_MS).x > 50);
  assert.ok(Math.abs(dodgePose(400).y) < 1e-9);
  assert.equal(dodgePose(400).x, 125);
  assert.ok(632 * 0.62 + 125 + 105 / 2 < 632);
});
test("miss visibly progresses through stumble, tip, belly landing and recovery", () => {
  assert.deepEqual(
    [180, 240, 310, 450, 800].map((t) => stumblePose(t).frame),
    [3, 4, 5, 6, 7],
  );
  assert.equal(stumblePose(160).x, 0);
  assert.equal(stumblePose(500).x, 72);
});
