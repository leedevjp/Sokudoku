/**
 * Omakase V2 policies. Pure functions keep the adaptive rules testable and
 * independent of Phaser, storage, and the FSRS scheduling implementation.
 */
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export type SkillSample = {
  difficulty: number;
  correct: boolean;
  ageDays: number;
};

/**
 * A backlog counts in relation to the learner's recent study capacity.
 * Weak and overdue items contribute more to weightedDue than fresh due cards.
 * Never let reviews prohibit new introductions entirely.
 */
export function reviewShare(weightedDue: number, activeCardsLastWeek: number): number {
  if (weightedDue <= 0) return 0.35;
  const dailyThroughput = Math.max(0, activeCardsLastWeek) / 7;
  const capacity = Math.max(35, dailyThroughput * 2.5);
  return clamp(0.35 + 0.5 * (1 - Math.exp(-weightedDue / capacity)), 0.35, 0.85);
}

/**
 * Fractional remainder stops five-question sets from rounding 85% to 100%
 * every time; e.g. four consecutive sets yield 4, 4, 4, 5 reviews.
 */
export function reviewSlots(
  share: number,
  carry: number,
  setSize = 5,
): { count: number; carry: number } {
  const exact = clamp(share, 0, 1) * setSize + carry;
  const count = clamp(Math.floor(exact + 1e-8), 0, setSize);
  return { count, carry: Math.max(0, exact - count) };
}

/** Convert the repository's 0..9 difficulty to the five visible levels. */
export function vocabularyTier(difficulty: number): number {
  return 1 + Math.floor(clamp(Number.isFinite(difficulty) ? difficulty : 0, 0, 9) / 2);
}

export function estimateSkill(
  ability: number,
  abilityCount: number,
  samples: SkillSample[],
): { center: number; spread: number } {
  // The global IRT ability is trusted only after observing vocabulary answers.
  // Brand-new learners start at level 1, regardless of the model's prior of 5.
  const confidence = clamp(Math.max(0, abilityCount) / 80, 0, 1);
  const base = 1 + (clamp(ability, 0, 10) / 2) * confidence;
  let residual = 0;
  let sampleWeight = 0;
  for (const sample of samples) {
    if (sample.difficulty < 0 || !Number.isFinite(sample.ageDays)) continue;
    const age = Math.max(0, sample.ageDays);
    if (age > 180) continue;
    const weight = 1 / (1 + age / 30);
    const sigmoid = 1 / (1 + Math.exp(-(ability + 0.97 - sample.difficulty) / 1.4));
    const predicted = 0.25 + 0.75 * sigmoid;
    residual += ((sample.correct ? 1 : 0) - predicted) * weight;
    sampleWeight += weight;
  }
  // Per-kind evidence can adjust the common ability estimate by at most
  // half a vocabulary stage. A small sample never causes an abrupt jump.
  const correction = sampleWeight
    ? clamp((residual / sampleWeight) * 1.5, -0.5, 0.5) *
      (sampleWeight / (sampleWeight + 25))
    : 0;
  const center = clamp(base + correction, 1, 5);
  const spread = clamp(1.15 - 0.043 * Math.log2(1 + sampleWeight), 0.75, 1.15);
  return { center, spread };
}

/** Bell-shaped probability weight for *new* vocabulary at an estimated level. */
export function noveltyWeight(tier: number, center: number, spread: number): number {
  const z = (tier - center) / Math.max(0.3, spread);
  return Math.max(0.002, Math.exp(-0.5 * z * z));
}
