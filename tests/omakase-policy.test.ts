import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateSkill,
  noveltyWeight,
  reviewShare,
  reviewSlots,
  vocabularyTier,
} from "../lib/game/learning/omakase-policy";

test("review pressure grows with backlog, but still reserves exploration", () => {
  const quiet = reviewShare(0, 140);
  const light = reviewShare(30, 140);
  const busy = reviewShare(900, 140);
  assert.equal(quiet, 0.35);
  assert.ok(light > quiet);
  assert.ok(busy >= 0.8 && busy <= 0.85);
  assert.ok(reviewShare(70, 35) > reviewShare(70, 700));
});

test("fractional quota preserves a 4:1 / 5:0 pattern without truncation loss", () => {
  let carry = 0;
  const batches: number[] = [];
  for (let i = 0; i < 4; i++) {
    const slots = reviewSlots(0.85, carry);
    batches.push(slots.count);
    carry = slots.carry;
  }
  assert.deepEqual(batches, [4, 4, 4, 5]);
  assert.ok(Math.abs(carry) < 1e-6);
});

test("a new learner starts at level one, an experienced learner uses ability", () => {
  assert.equal(estimateSkill(5, 0, []).center, 1);
  const skilled = estimateSkill(7, 1000, []);
  assert.ok(skilled.center > 4 && skilled.center < 5);
});

test("new-question distribution is bell-shaped and follows the skill center", () => {
  const high = estimateSkill(7, 1000, []);
  assert.ok(noveltyWeight(4, high.center, high.spread) > noveltyWeight(2, high.center, high.spread));
  assert.ok(noveltyWeight(5, high.center, high.spread) > noveltyWeight(1, high.center, high.spread));
  const novice = estimateSkill(5, 0, []);
  assert.ok(noveltyWeight(1, novice.center, novice.spread) > noveltyWeight(4, novice.center, novice.spread));
});

test("reading and meaning evidence can adjust estimates independently", () => {
  const good = Array.from({ length: 70 }, () => ({ difficulty: 8, correct: true, ageDays: 1 }));
  const weak = Array.from({ length: 70 }, () => ({ difficulty: 8, correct: false, ageDays: 1 }));
  const goodSkill = estimateSkill(6.5, 2000, good);
  const weakSkill = estimateSkill(6.5, 2000, weak);
  assert.ok(goodSkill.center > weakSkill.center);
  assert.ok(goodSkill.center - weakSkill.center < 1);
});

test("personal word difficulty maps to its own vocabulary tier", () => {
  assert.equal(vocabularyTier(0), 1);
  assert.equal(vocabularyTier(3), 2);
  assert.equal(vocabularyTier(6), 4);
  assert.equal(vocabularyTier(9), 5);
  assert.equal(vocabularyTier(10), 5);
});
