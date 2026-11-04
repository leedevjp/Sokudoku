import test from "node:test";
import assert from "node:assert/strict";
import {
  PetMotionState,
  petFrame,
  petPose,
  PET_CLIPS,
} from "../lib/game/pet-motion";
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

test("idle moves between atlas frames while reduced-motion stays completely static", () => {
  assert.equal(petPose("idle", 100).frame, petPose("idle", 200).frame);
  assert.notEqual(petPose("idle", 100).scaleY, petPose("idle", 200).scaleY);
  assert.deepEqual(petPose("idle", 100, true), petPose("idle", 200, true));
});
test("sub-frame breathing stays bounded and pose blending is continuous at frame boundaries", () => {
  for (const motion of Object.keys(PET_CLIPS) as (keyof typeof PET_CLIPS)[]) {
    for (let t = 0; t < 8000; t += 16) {
      const a = petPose(motion, t),
        b = petPose(motion, t + 16);
      assert.ok(a.mix >= 0 && a.mix <= 1);
      assert.ok(a.scaleX >= 0.95 && a.scaleX <= 1.05);
      assert.ok(a.scaleY >= 0.95 && a.scaleY <= 1.07);
      assert.ok(Math.abs(a.scaleY - b.scaleY) < 0.01);
      assert.ok(a.next >= 0 && a.next < 16);
    }
    const end = petPose(motion, PET_CLIPS[motion].step - 0.01);
    const next = petPose(motion, PET_CLIPS[motion].step);
    assert.equal(end.next, next.frame);
    if (
      end.frame === end.next ||
      ["hop", "happy", "celebrate"].includes(motion)
    )
      assert.equal(end.mix, 0);
    else assert.ok(end.mix > 0.99);
  }
});
