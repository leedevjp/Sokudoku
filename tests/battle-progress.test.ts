import test from "node:test";
import assert from "node:assert/strict";
import { BattleProgress, battleRegion, comboTier, idleBattlePose } from "../lib/game/battle-progress";

test("combo rewards follow consecutive correct answers and reset on mistakes or timeout", () => {
  const progress = new BattleProgress();
  for (let i = 0; i < 10; i++) progress.record("correct");
  assert.equal(progress.combo, 10);
  assert.equal(comboTier(progress.combo), 3);
  progress.record("incorrect");
  assert.equal(progress.combo, 0);
  assert.equal(progress.bestCombo, 10);
  progress.record("correct");
  progress.record("timeout");
  assert.equal(progress.combo, 0);
  progress.reset();
  assert.equal(progress.bestCombo, 0);
  assert.deepEqual([0, 2, 3, 4, 5, 9, 10, 30].map(comboTier), [0, 0, 1, 1, 2, 2, 3, 3]);
});
test("regions advance every ten correct answers and cycle through all three maps", () => {
  assert.deepEqual([0, 9, 10, 19, 20, 29, 30].map(battleRegion), [0, 0, 1, 1, 2, 2, 0]);
});
test("idle motion stays within the arena and reduced motion is static", () => {
  for (let t = 0; t < 10000; t += 16) {
    const pose = idleBattlePose(t, false);
    assert.ok(Math.abs(pose.mageX) <= 2 && Math.abs(pose.mageY) <= 1.5);
    assert.ok(Math.abs(pose.monsterX) <= 7 && pose.monsterY >= -9 && pose.monsterY <= 0);
    assert.deepEqual(idleBattlePose(t, true), { mageX: 0, mageY: 0, monsterX: 0, monsterY: 0 });
  }
});
