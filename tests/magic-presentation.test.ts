import test from "node:test";
import assert from "node:assert/strict";
import {
  magicEncounter,
  magicCastFrame,
  magicFallFrame,
  magicImpactFrame,
  SPELL_HIT_MS,
  SPELL_HIT_STOP_MS,
} from "../lib/game/magic-presentation";
import { CORRECT_FEEDBACK_MS } from "../lib/game/rules";
test("magic reaches contact within the existing half-second answer cadence", () => {
  assert.ok(SPELL_HIT_MS + CORRECT_FEEDBACK_MS <= 500);
  assert.equal(magicCastFrame(0), 4);
  assert.equal(magicCastFrame(SPELL_HIT_MS), 6);
  assert.equal(magicImpactFrame(-1), null);
  assert.equal(magicImpactFrame(0), 2);
  assert.equal(magicImpactFrame(SPELL_HIT_STOP_MS - 1), 2);
  assert.equal(magicImpactFrame(SPELL_HIT_STOP_MS), 3);
  assert.equal(magicImpactFrame(290), null);
});
test("failed magic visibly falls and recovers without leaving the mage atlas", () => {
  const frames = new Set<number>();
  for (let t = 160; t < 2000; t += 10) {
    const f = magicFallFrame(t);
    assert.ok(f >= 8 && f <= 15);
    frames.add(f);
  }
  assert.deepEqual([...frames], [8, 9, 10, 11, 12, 13, 14, 15]);
});
test("cosmetic encounter selection is stable across redraws and covers all species/elements", () => {
  const pairs = new Set<string>();
  for (let i = 0; i < 256; i++) {
    const key = `word-${i}`,
      a = magicEncounter(key);
    assert.deepEqual(a, magicEncounter(key));
    assert.ok(
      a.monster >= 0 && a.monster < 4 && a.element >= 0 && a.element < 4,
    );
    pairs.add(`${a.monster}-${a.element}`);
  }
  assert.equal(pairs.size, 16);
});
