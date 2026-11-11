import assert from "node:assert/strict";
import test from "node:test";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { LearningEngine } from "../lib/game/learning/engine";
import type { Word } from "../lib/game/types";

const words = (size: number, personal = false): Word[] =>
  Array.from({ length: size }, (_, i) => ({
    id: String(i),
    term: `term${i}`,
    kana: `かな${i}`,
    meaning_ko: `meaning${i}`,
    hanja_reading: null,
    has_kanji: true,
    difficulty: Math.floor(i / (size / 5)) * 2,
    deleted_at: null,
    ...(personal ? { source: "personal" as const } : {}),
  }));

const seeded = (seed: number) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

test("Omakase V2 backs off new introductions when many overdue reviews exist", async () => {
  const pool = words(250);
  const engine = await LearningEngine.create();
  const answeredAt = new Date(Date.now() - 86_400_000).toISOString();
  for (const word of pool.slice(0, 120)) {
    engine.apply({
      id: `prior-${word.id}`, word_id: word.id, source: "word",
      question_type: "meaning", result: "incorrect",
      difficulty: word.difficulty, answered_at: answeredAt,
    });
  }
  const planner = new TrainingPlanner(engine, pool, ["meaning"], ["auto"], seeded(11));
  const batch = Array.from({ length: 20 }, () => planner.next()!);
  const reviews = batch.filter((q) => q.mode === "review").length;
  const exploration = batch.filter((q) => q.mode === "exploration").length;
  assert.ok(reviews >= 12, `expected review priority, got ${reviews}/20`);
  assert.ok(exploration >= 1, "even a large review backlog should allow new words");
  assert.equal(reviews + exploration, 20);
});

test("Omakase V2 selects high-tier *new* words more often for high-ability learners", async () => {
  const pool = words(500);
  const engine = await LearningEngine.create();
  engine.learner.ability = 7;
  engine.learner.ability_count = 1000;
  const planner = new TrainingPlanner(engine, pool, ["meaning"], ["auto"], seeded(27));
  const batch = Array.from({ length: 100 }, () => planner.next()!);
  const high = batch.filter((q) => q.word.difficulty >= 6).length;
  const low = batch.filter((q) => q.word.difficulty <= 2).length;
  assert.ok(high > low * 2, `expected ability-biased distribution, got ${high} high and ${low} low`);
  assert.ok(batch.every((q) => q.mode === "exploration"));
});

test("Omakase V2 reads personal-word difficulty instead of treating all P as the center", async () => {
  const pool = words(150, true);
  const engine = await LearningEngine.create();
  engine.learner.ability = 7;
  engine.learner.ability_count = 1000;
  const planner = new TrainingPlanner(engine, pool, ["meaning"], ["auto"], seeded(7));
  const batch = Array.from({ length: 80 }, () => planner.next()!);
  const high = batch.filter((q) => q.word.difficulty >= 6).length;
  const low = batch.filter((q) => q.word.difficulty <= 2).length;
  assert.ok(high > low, `expected advanced P focus, got ${high} high vs ${low} low`);
});

test("Omakase V2 keeps practicing when all cards are learned and due in the future", async () => {
  const pool = words(12);
  const engine = await LearningEngine.create();
  for (const word of pool) {
    engine.apply({
      id: `learned-${word.id}`, word_id: word.id, source: "word",
      question_type: "meaning", result: "correct",
      difficulty: word.difficulty, answered_at: new Date().toISOString(),
    });
  }
  const planner = new TrainingPlanner(engine, pool, ["meaning"], ["auto"], seeded(17));
  const batch = Array.from({ length: 35 }, () => planner.next());
  assert.ok(batch.every(Boolean));
  assert.ok(batch.every((q) => q?.mode === "review"));
});
