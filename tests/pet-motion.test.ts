import test from "node:test";
import assert from "node:assert/strict";
import { PetMotionState, petFrame, PET_CLIPS } from "../lib/game/pet-motion";
test("a short celebration survives question redraw time and returns to idle", () => {
  const state = new PetMotionState();
  state.play("happy");
  state.tick(320);
  assert.equal(state.motion, "happy");
  state.tick(280);
  assert.equal(state.motion, "idle");
});
test("pause freezes reaction time, and reduced motion uses a static expression", () => {
  const state = new PetMotionState();
  state.play("hop");
  state.tick(300, true);
  assert.equal(state.elapsed, 0);
  for (const name of Object.keys(PET_CLIPS) as (keyof typeof PET_CLIPS)[]) {
    assert.equal(petFrame(name, 3000, true), petFrame(name, 0, true));
    for (let t = 0; t < 8000; t += 50)
      assert.ok(petFrame(name, t) >= 0 && petFrame(name, t) < 16);
  }
});
test("encouragement and completion loop until the scene changes state", () => {
  const state = new PetMotionState();
  state.play("encourage");
  state.tick(20000);
  assert.equal(state.motion, "encourage");
  state.play("celebrate");
  state.tick(20000);
  assert.equal(state.motion, "celebrate");
});
