import { entryType, type Answer, type Kind, type Question, type Word } from "../types";
import { questionFor } from "../question";
import { trainingKinds } from "../selection";
import { LearningEngine } from "./engine";
import { cardKey, type TrainingMode, wordKey } from "./types";
import { explorationWeights } from "./exploration";
import { reviewCandidates } from "./review";
import { cryptoRandom } from "./random";
import { estimateSkill, noveltyWeight, reviewShare, reviewSlots, vocabularyTier, type SkillSample } from "./omakase-policy";

// Preserve the existing public import used by callers and regression tests.
export { explorationWeights } from "./exploration";

type Candidate = { word: Word; kind?: Kind; weight: number };
export type PlannedQuestion = Question & { mode: TrainingMode };

function draw<T extends Candidate>(candidates: T[], rng: () => number): T {
  let n = rng() * candidates.reduce((sum, c) => sum + c.weight, 0);
  for (const candidate of candidates) {
    n -= candidate.weight;
    if (n < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

/** A set is frozen: answers update memory now, but affect only the next set. */
export class TrainingPlanner {
  private queue: PlannedQuestion[] = [];
  private readonly byKey: Map<string, Word>;
  private lastWord: string | undefined;
  private seen = new Set<string>();
  private recentWords: string[] = [];
  private autoReviewCarry = 0;
  private prepared = false;
  private preparing?: Promise<void>;
  private generation = 0;
  private readonly encounters = new Map<string, number>();
  constructor(
    readonly engine: LearningEngine,
    private words: Word[],
    private kinds: Kind[] = trainingKinds,
    private modes: TrainingMode[] = ["exploration", "review"],
    private rng: () => number = cryptoRandom,
    private prepareQuestion?: (word: Word, kind: Kind) => Promise<void>,
  ) {
    this.byKey = new Map(
      words.map((word) => [wordKey(word.source, word.id), word]),
    );
    // FSRS repetitions preserve answered encounters across sessions and modes.
    // Reading and meaning share a word count; personal copies retain their own history.
    for (const state of engine.words.values()) {
      const key = wordKey(state.source, state.word_ref);
      this.encounters.set(key, (this.encounters.get(key) ?? 0) + state.card.reps);
    }
  }
  resetSet() {
    this.generation++;
    this.prepared = false;
    this.queue = [];
    this.lastWord = undefined;
    this.seen.clear();
    this.recentWords = [];
    this.autoReviewCarry = 0;
  }
  next(): PlannedQuestion | null {
    this.ensureSet();
    const question = this.queue.shift() ?? null;
    if (question) {
      this.lastWord = wordKey(question.word.source, question.word.id);
      // Count only questions taken for display, never the prepared queue or redraws.
      question.encounterCount = (this.encounters.get(this.lastWord) ?? 0) + 1;
      this.encounters.set(this.lastWord, question.encounterCount);
      this.seen.add(this.lastWord);
      this.recentWords.push(this.lastWord);
      if (this.recentWords.length > 15) this.recentWords.shift();
      if (!this.queue.length) this.prepared = false;
    }
    return question;
  }
  hasQuestions() {
    this.ensureSet();
    return this.queue.length > 0;
  }
  private ensureSet() {
    if (this.queue.length || this.prepared) return;
    if (this.prepareQuestion) throw Error("SET_NOT_PREPARED");
    for (const request of this.makeSet()) void request;
    this.prepared = true;
  }
  /** Select first, then prepare only those questions. Never precompute the catalog. */
  async prepareSet(): Promise<void> {
    if (!this.prepareQuestion) { this.ensureSet(); return; }
    if (this.preparing) {
      await this.preparing;
      if (!this.queue.length && !this.prepared) await this.prepareSet();
      return;
    }
    if (this.queue.length || this.prepared) return;
    const generation = this.generation;
    const work = (async () => {
      const iterator = this.makeSet();
      let step = iterator.next();
      while (!step.done) {
        await this.prepareQuestion!(step.value.word, step.value.kind);
        if (generation !== this.generation) { iterator.return(); return; }
        step = iterator.next();
      }
      this.prepared = true;
    })();
    this.preparing = work;
    try { await work; } finally { if (this.preparing === work) this.preparing = undefined; }
    if (generation !== this.generation) await this.prepareSet();
  }
  record(answer: Answer, word: Word) {
    this.engine.apply({
      ...answer,
      source: word.source ?? "word",
      difficulty: word.difficulty,
    });
  }
  progress(now = Date.now()) {
    const known = new Set(this.seen);
    for (const state of this.engine.words.values())
      known.add(wordKey(state.source, state.word_ref));
    const unseen = this.words.filter(
      (word) => !known.has(wordKey(word.source, word.id)),
    ).length;
    const review = new Set(
      reviewCandidates(this.engine, this.byKey, this.kinds, now).map(
        ({ word }) => wordKey(word.source, word.id),
      ),
    ).size;
    const future = [...this.engine.words.values()]
      .filter((state) => {
        const word = this.byKey.get(wordKey(state.source, state.word_ref));
        return (
          word &&
          this.kinds.includes(state.question_type) &&
          (state.question_type !== "reading" || word.has_kanji) &&
          state.last_result === "correct" &&
          Date.parse(state.due_at) > now
        );
      })
      .map((state) => Date.parse(state.due_at));
    return {
      total: this.byKey.size,
      unseen,
      review,
      nextDue: future.length ? Math.min(...future) : null,
    };
  }
  private *select(
    candidates: Candidate[],
    used: Set<string>,
    mode: Exclude<TrainingMode, "auto">,
  ): Generator<{ word: Word; kind: Kind }, PlannedQuestion[], void> {
    const questions: PlannedQuestion[] = [];
    let remaining = candidates
      .filter((c) => !used.has(wordKey(c.word.source, c.word.id)))
      .map((c) => ({
        ...c,
        weight:
          c.weight *
          (mode === "review" &&
          wordKey(c.word.source, c.word.id) === this.lastWord
            ? 0.05
            : 1),
      }));
    // Bounded retries handle words that cannot form four disjoint choices.
    for (
      let attempt = 0;
      attempt < 64 && remaining.length && questions.length < 5;
      attempt++
    ) {
      const selected = draw(remaining, this.rng);
      const key = wordKey(selected.word.source, selected.word.id);
      remaining = remaining.filter(
        (c) => wordKey(c.word.source, c.word.id) !== key,
      );
      const available = this.kinds.filter(
        (kind) => kind === "meaning" || selected.word.has_kanji,
      );
      const first =
        selected.kind ?? available[Math.floor(this.rng() * available.length)];
      const kinds = selected.kind
        ? [selected.kind]
        : [first, ...available.filter((kind) => kind !== first)];
      for (const kind of kinds) {
        yield { word: selected.word, kind };
        const question = questionFor(selected.word, kind, this.words, this.rng);
        if (question) {
          questions.push({ ...question, mode });
          used.add(key);
          break;
        }
      }
    }
    return questions;
  }

  /**
   * Omakase V2: derive a review/new budget from overdue FSRS workload, then
   * sample *new vocabulary* from an ability-centered difficulty distribution.
   * Due reviews remain primarily FSRS-driven, including easy forgotten cards.
   *
   * The selected H/K/1–5/P range and selected question kinds are hard filters.
   * If neither due reviews nor new cards remain, maintenance keeps the run open.
   */
  private *makeAutoSet(): Generator<{ word: Word; kind: Kind }, void, void> {
    type AutoTicket = {
      word: Word;
      kind: Kind;
      bucket: "review" | "exploration" | "maintenance";
      tier: number;
      weight: number;
    };
    const now = Date.now();
    const states = this.engine.words;
    const available = this.words.flatMap((word) =>
      this.kinds
        .filter((kind) => kind === "meaning" || (entryType(word) === "word" && word.has_kanji))
        .map((kind) => ({ word, kind, state: states.get(cardKey(word.source, word.id, kind)) })),
    );
    if (!available.length) return;

    // Keep the V1 kana onboarding, but never require every character to be
    // memorized before graduating. Existing learners can enter vocabulary.
    const kanaReady = (type: "hiragana" | "katakana") => {
      const seen = available.filter(({ word, kind, state }) =>
        entryType(word) === type && kind === "meaning" && state,
      );
      return seen.length >= 12 &&
        seen.filter(({ state }) => state?.last_result === "correct").length / seen.length >= 0.8;
    };
    const hasH = available.some(({ word }) => entryType(word) === "hiragana");
    const hasK = available.some(({ word }) => entryType(word) === "katakana");
    const kanaFocus = hasH && !kanaReady("hiragana") ? 0 :
      hasK && !kanaReady("katakana") ? 1 : null;

    // The persisted ability estimate measures correct/incorrect evidence, not
    // response speed. Recent card outcomes provide a modest correction *per
    // question kind*, without assuming reading and meaning are identical.
    const samples: Record<Kind, SkillSample[]> = { meaning: [], reading: [] };
    for (const { word, kind, state } of available) {
      if (!state || entryType(word) !== "word") continue;
      const ageDays = (now - Date.parse(state.last_review_at)) / 86_400_000;
      if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 180) continue;
      samples[kind].push({
        difficulty: word.difficulty,
        correct: state.last_result === "correct",
        ageDays,
      });
    }
    const skill = {
      meaning: estimateSkill(this.engine.learner.ability, this.engine.learner.ability_count, samples.meaning),
      reading: estimateSkill(this.engine.learner.ability, this.engine.learner.ability_count, samples.reading),
    };

    const scheduled = new Map<string, number>(
      reviewCandidates(this.engine, this.byKey, this.kinds, now).map((item) => [
        cardKey(item.word.source, item.word.id, item.kind),
        item.weight,
      ] as const),
    );
    const recent = new Set([this.lastWord, ...this.recentWords]);
    const tickets: AutoTicket[] = available.map(({ word, kind, state }) => {
      const type = entryType(word);
      const tier = type === "hiragana" ? 0 :
        type === "katakana" ? 1 : vocabularyTier(word.difficulty) + 1;
      const gated = (kanaFocus === 0 && tier > 0) ||
        (kanaFocus === 1 && tier > 1);
      const bucket: AutoTicket["bucket"] = !state ? "exploration" :
        state.last_result !== "correct" || Date.parse(state.due_at) <= now
          ? "review" : "maintenance";
      const newWeight = tier < 2
        ? (kanaFocus === tier ? 1 : 0.035)
        : noveltyWeight(tier - 1, skill[kind].center, skill[kind].spread);
      const scheduledWeight = scheduled.get(cardKey(word.source, word.id, kind));
      const recallRisk = state ? 1 - this.engine.retrievability(state, now) : 0;
      const match = bucket === "exploration" ? newWeight :
        bucket === "review" ? (scheduledWeight ?? 1) :
        (0.12 + recallRisk + 0.5 * newWeight);
      const prior = recent.has(wordKey(word.source, word.id)) ? 0.05 : 1;
      return { word, kind, bucket, tier, weight: gated ? 0 : match * prior };
    });

    // Normalize the novel tier pools, not due reviews. With thousands of N1
    // words and fewer N5 words, the *distribution*, not catalog size, decides
    // exploration difficulty. Conversely every overdue FSRS card competes on
    // memory urgency rather than on the size of its level's pool.
    const groupSizes = new Map<string, number>();
    for (const ticket of tickets) {
      if (ticket.bucket === "review" || ticket.weight <= 0) continue;
      const key = `${ticket.bucket}:${ticket.tier}`;
      groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
    }
    for (const ticket of tickets) {
      if (ticket.bucket !== "review" && ticket.weight > 0)
        ticket.weight /= groupSizes.get(`${ticket.bucket}:${ticket.tier}`) ?? 1;
    }

    // Estimate real review pressure within the selected and unlocked scope.
    // Compare weighted due work to the user's distinct active cards last week.
    const active = tickets.filter((ticket) => ticket.weight > 0);
    const dueWork = active.reduce((sum, ticket) =>
      sum + (ticket.bucket === "review"
        ? (scheduled.get(cardKey(ticket.word.source, ticket.word.id, ticket.kind)) ?? 1)
        : 0), 0);
    const weekAgo = now - 7 * 86_400_000;
    const recentlyStudied = available.filter(({ word, state }) => {
      if (!state || Date.parse(state.last_review_at) < weekAgo) return false;
      const tier = entryType(word) === "hiragana" ? 0 :
        entryType(word) === "katakana" ? 1 : vocabularyTier(word.difficulty) + 1;
      return kanaFocus === null || tier <= kanaFocus;
    }).length;

    const hasReview = active.some((ticket) => ticket.bucket === "review");
    const hasNew = active.some((ticket) => ticket.bucket === "exploration");
    let requestedReviews = 0;
    if (hasReview && !hasNew) requestedReviews = 5;
    else if (hasReview && hasNew) {
      const quota = reviewSlots(reviewShare(dueWork, recentlyStudied), this.autoReviewCarry);
      requestedReviews = quota.count;
      this.autoReviewCarry = quota.carry;
    }
    const order: AutoTicket["bucket"][] = Array.from({ length: 5 }, (_, i) =>
      i < requestedReviews ? "review" : "exploration",
    );
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const used = new Set<string>();
    const rejected = new Set<string>();
    for (const desired of order) {
      const priorities: AutoTicket["bucket"][] = desired === "review"
        ? ["review", "exploration", "maintenance"]
        : ["exploration", "review", "maintenance"];
      let chosen: PlannedQuestion | undefined;
      for (const bucket of priorities) {
        const candidates = tickets.filter((ticket) =>
          ticket.bucket === bucket && ticket.weight > 0 &&
          !used.has(wordKey(ticket.word.source, ticket.word.id)) &&
          !rejected.has(cardKey(ticket.word.source, ticket.word.id, ticket.kind)),
        );
        for (let attempt = 0; attempt < Math.min(40, candidates.length); attempt++) {
          if (!candidates.length) break;
          const ticket = draw(candidates, this.rng);
          candidates.splice(candidates.indexOf(ticket), 1);
          yield { word: ticket.word, kind: ticket.kind };
          const question = questionFor(ticket.word, ticket.kind, this.words, this.rng);
          if (question) {
            chosen = { ...question, mode: bucket === "exploration" ? "exploration" : "review" };
            used.add(wordKey(ticket.word.source, ticket.word.id));
            break;
          }
          rejected.add(cardKey(ticket.word.source, ticket.word.id, ticket.kind));
        }
        if (chosen) break;
      }
      if (chosen) this.queue.push(chosen);
    }
    if (!this.queue.length && available.length) throw Error("QUESTION_BUILD_FAILED");
  }

  private *makeSet(): Generator<{ word: Word; kind: Kind }, void, void> {
    if (this.modes.includes("auto")) {
      yield* this.makeAutoSet();
      return;
    }
    if (this.modes.includes("exam")) {
      // No learned/due/ability filtering: each word has exactly one ticket.
      // Each frozen five-question set is unique; later sets can repeat words.
      const exam = yield* this.select(
        explorationWeights(this.words),
        new Set(),
        "exam",
      );
      if (!exam.length && this.words.length)
        throw new Error("QUESTION_BUILD_FAILED");
      this.queue.push(...exam);
      return;
    }
    const now = Date.now(),
      used = new Set<string>();
    const candidates = reviewCandidates(
      this.engine,
      this.byKey,
      this.kinds,
      now,
    );
    const review = this.modes.includes("review")
      ? yield* this.select(candidates, used, "review")
      : [];
    const known = new Set(this.seen);
    for (const state of this.engine.words.values())
      known.add(wordKey(state.source, state.word_ref));
    const unseen = this.words.filter(
      (word) => !known.has(wordKey(word.source, word.id)),
    );
    const exploration = this.modes.includes("exploration")
      ? yield* this.select(explorationWeights(unseen), used, "exploration")
      : [];
    if (
      !review.length &&
      !exploration.length &&
      ((this.modes.includes("review") && candidates.length > 0) ||
        (this.modes.includes("exploration") && unseen.length > 0))
    )
      throw new Error("QUESTION_BUILD_FAILED");
    for (let i = 0; i < Math.max(exploration.length, review.length); i++) {
      if (exploration[i]) this.queue.push(exploration[i]);
      if (review[i]) this.queue.push(review[i]);
    }
  }
}
