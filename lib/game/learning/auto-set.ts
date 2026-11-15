import { entryType, type Kind, type Word } from "../types";
import { questionFor } from "../question";
import type { LearningEngine } from "./engine";
import { autoPool, type AutoEntry } from "./auto-pool";
import type { LearningWord } from "./types";
import { estimateSkill, noveltyWeight, reviewShare, reviewSlots, vocabularyTier, type SkillSample } from "./omakase-policy";
import { draw, type PlannedQuestion, type PreparationStep, type SelectionContext } from "./question-selection";

export type AutoReviewBudget = { carry: number };
type AutoSetContext = SelectionContext & {
  engine: LearningEngine;
  byKey: Map<string, Word>;
  recentWords: string[];
  queue: PlannedQuestion[];
  budget: AutoReviewBudget;
  cooperative?: boolean;
};

/**
 * Omakase V2: derive a review/new budget from overdue FSRS workload, then
 * sample *new vocabulary* from an ability-centered difficulty distribution.
 * Due reviews remain primarily FSRS-driven, including easy forgotten cards.
 *
 * The selected H/K/1–5/P range and selected question kinds are hard filters.
 * If neither due reviews nor new cards remain, maintenance keeps the run open.
 */
export function* makeAutoSet(context: AutoSetContext): Generator<PreparationStep, void, void> {
  type AutoTicket = {
    word: Word;
    kind: Kind;
    bucket: "review" | "exploration" | "maintenance";
    tier: number;
    weight: number;
    key: string;
    wordKey: string;
  };
  const now = Date.now();
  const states = context.engine.words;
  const pool = yield* autoPool(context.words, context.kinds, !!context.cooperative);
  const available: (AutoEntry & { type: ReturnType<typeof entryType>; state: LearningWord | undefined;
    tier: number; lastReview: number; due: number })[] = [];
  for (const [i, item] of pool.entries()) {
    const type = entryType(item.word);
    if (item.kind === "meaning" || (type === "word" && item.word.has_kanji)) {
      const state = states.get(item.key);
      available.push({ ...item, type, state, tier: type === "hiragana" ? 0 : type === "katakana" ? 1 : vocabularyTier(item.word.difficulty) + 1,
        lastReview: state ? Date.parse(state.last_review_at) : NaN, due: state ? Date.parse(state.due_at) : NaN });
    }
    if (context.cooperative && i % 256 === 255) yield null;
  }
  if (!available.length) return;

  // Keep the V1 kana onboarding, but never require every character to be
  // memorized before graduating. Existing learners can enter vocabulary.
  const kanaReady = (type: "hiragana" | "katakana") => {
    const seen = available.filter(({ type: entry, kind, state }) =>
      entry === type && kind === "meaning" && state,
    );
    return seen.length >= 12 &&
      seen.filter(({ state }) => state?.last_result === "correct").length / seen.length >= 0.8;
  };
  const hasH = available.some(({ type }) => type === "hiragana");
  const hasK = available.some(({ type }) => type === "katakana");
  const kanaFocus = hasH && !kanaReady("hiragana") ? 0 :
    hasK && !kanaReady("katakana") ? 1 : null;

  // The persisted ability estimate measures correct/incorrect evidence, not
  // response speed. Recent card outcomes provide a modest correction *per
  // question kind*, without assuming reading and meaning are identical.
  const samples: Record<Kind, SkillSample[]> = { meaning: [], reading: [] };
  for (const [i, { word, kind, state, type, lastReview }] of available.entries()) {
    if (context.cooperative && i % 256 === 255) yield null;
    if (!state || type !== "word") continue;
    const ageDays = (now - lastReview) / 86_400_000;
    if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 180) continue;
    samples[kind].push({
      difficulty: word.difficulty,
      correct: state.last_result === "correct",
      ageDays,
    });
  }
  const skill = {
    meaning: estimateSkill(context.engine.learner.ability, context.engine.learner.ability_count, samples.meaning),
    reading: estimateSkill(context.engine.learner.ability, context.engine.learner.ability_count, samples.reading),
  };
  if (context.cooperative) yield null;

  const scheduled = new Map<string, number>();
  const recent = new Set([context.lastWord, ...context.recentWords]);
  const tickets: AutoTicket[] = [];
  for (const [i, { word, kind, state, tier, due, key, wordKey }] of available.entries()) {
    if (context.cooperative && i % 256 === 255) yield null;
    const gated = (kanaFocus === 0 && tier > 0) ||
      (kanaFocus === 1 && tier > 1);
    const bucket: AutoTicket["bucket"] = !state ? "exploration" :
      state.last_result !== "correct" || due <= now
        ? "review" : "maintenance";
    const newWeight = tier < 2
      ? (kanaFocus === tier ? 1 : 0.035)
      : noveltyWeight(tier - 1, skill[kind].center, skill[kind].spread);
    const recallRisk = state ? 1 - context.engine.retrievability(state, now) : 0;
    // Same review formula as reviewCandidates, but reuse this recall estimate
    // instead of traversing all cards and calculating it twice.
    const scheduledWeight = bucket === "review"
      ? 0.05 + recallRisk + (state!.last_result !== "correct" ? 0.5 : 0) + Math.min(2, Math.log1p(Math.max(0, (now - due) / 86_400_000))) : undefined;
    if (scheduledWeight !== undefined) scheduled.set(key, scheduledWeight);
    const match = bucket === "exploration" ? newWeight :
      bucket === "review" ? (scheduledWeight ?? 1) :
      (0.12 + recallRisk + 0.5 * newWeight);
    const prior = recent.has(wordKey) ? 0.05 : 1;
    tickets.push({ word, kind, bucket, tier, key, wordKey, weight: gated ? 0 : match * prior });
  }

  // Normalize the novel tier pools, not due reviews. With thousands of N1
  // words and fewer N5 words, the *distribution*, not catalog size, decides
  // exploration difficulty. Conversely every overdue FSRS card competes on
  // memory urgency rather than on the size of its level's pool.
  const groupSizes = new Map<string, number>();
  for (const [i, ticket] of tickets.entries()) {
    if (context.cooperative && i % 256 === 255) yield null;
    if (ticket.bucket === "review" || ticket.weight <= 0) continue;
    const key = `${ticket.bucket}:${ticket.tier}`;
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }
  for (const [i, ticket] of tickets.entries()) {
    if (context.cooperative && i % 256 === 255) yield null;
    if (ticket.bucket !== "review" && ticket.weight > 0)
      ticket.weight /= groupSizes.get(`${ticket.bucket}:${ticket.tier}`) ?? 1;
  }

  // Estimate real review pressure within the selected and unlocked scope.
  // Compare weighted due work to the user's distinct active cards last week.
  const active = tickets.filter((ticket) => ticket.weight > 0);
  const dueWork = active.reduce((sum, ticket) =>
    sum + (ticket.bucket === "review"
      ? (scheduled.get(ticket.key) ?? 1)
      : 0), 0);
  const weekAgo = now - 7 * 86_400_000;
  const recentlyStudied = available.filter(({ state, tier, lastReview }) => {
    if (!state || lastReview < weekAgo) return false;
    return kanaFocus === null || tier <= kanaFocus;
  }).length;

  const hasReview = active.some((ticket) => ticket.bucket === "review");
  const hasNew = active.some((ticket) => ticket.bucket === "exploration");
  let requestedReviews = 0;
  if (hasReview && !hasNew) requestedReviews = 5;
  else if (hasReview && hasNew) {
    const quota = reviewSlots(reviewShare(dueWork, recentlyStudied), context.budget.carry);
    requestedReviews = quota.count;
    context.budget.carry = quota.carry;
  }
  const order: AutoTicket["bucket"][] = Array.from({ length: 5 }, (_, i) =>
    i < requestedReviews ? "review" : "exploration",
  );
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(context.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const used = new Set<string>();
  const rejected = new Set<string>();
  const buckets: Record<AutoTicket["bucket"], AutoTicket[]> = { review: [], exploration: [], maintenance: [] };
  for (const ticket of tickets) if (ticket.weight > 0) buckets[ticket.bucket].push(ticket);
  for (const desired of order) {
    if (context.cooperative) yield null;
    const priorities: AutoTicket["bucket"][] = desired === "review"
      ? ["review", "exploration", "maintenance"]
      : ["exploration", "review", "maintenance"];
    let chosen: PlannedQuestion | undefined;
    for (const bucket of priorities) {
      const candidates = buckets[bucket].filter((ticket) =>
        !used.has(ticket.wordKey) && !rejected.has(ticket.key),
      );
      for (let attempt = 0; attempt < Math.min(40, candidates.length); attempt++) {
        if (!candidates.length) break;
        const ticket = draw(candidates, context.rng);
        candidates.splice(candidates.indexOf(ticket), 1);
        yield { word: ticket.word, kind: ticket.kind };
        const question = questionFor(ticket.word, ticket.kind, context.words, context.rng);
        if (question) {
          chosen = { ...question, mode: bucket === "exploration" ? "exploration" : "review" };
          used.add(ticket.wordKey);
          break;
        }
        rejected.add(ticket.key);
      }
      if (chosen) break;
    }
    if (chosen) context.queue.push(chosen);
  }
  if (!context.queue.length && available.length) throw Error("QUESTION_BUILD_FAILED");
}
