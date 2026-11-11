import { entryType, type Answer, type Kind, type Question, type Word } from "../types";
import { questionFor } from "../question";
import { trainingKinds } from "../selection";
import { LearningEngine } from "./engine";
import { cardKey, type TrainingMode, wordKey } from "./types";
import { explorationWeights } from "./exploration";
import { reviewCandidates } from "./review";
import { cryptoRandom } from "./random";

// Preserve the existing public import used by callers and regression tests.
export { explorationWeights } from "./exploration";

type Candidate = { word: Word; kind?: Kind; weight: number };
export type PlannedQuestion = Question & { mode: TrainingMode };

function draw(candidates: Candidate[], rng: () => number) {
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
  private prepared = false;
  private preparing?: Promise<void>;
  private generation = 0;
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
  }
  resetSet() {
    this.generation++;
    this.prepared = false;
    this.queue = [];
    this.lastWord = undefined;
    this.seen.clear();
    this.recentWords = [];
  }
  next(): PlannedQuestion | null {
    this.ensureSet();
    const question = this.queue.shift() ?? null;
    if (question) {
      this.lastWord = wordKey(question.word.source, question.word.id);
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
    mode: TrainingMode,
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
   * Omakase V1: schedule five questions at a time across the entire user-selected
   * scope. First encounters explore; due/failed cards review; when neither exists,
   * familiar cards provide endless reading practice. Manual modes stay unchanged.
   */
  private *makeAutoSet(): Generator<{ word: Word; kind: Kind }, void, void> {
    type AutoTicket = {
      word: Word;
      kind: Kind;
      bucket: "review" | "exploration" | "maintenance";
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

    // Learning tracks: hiragana, katakana, then the requested vocabulary levels.
    // A proficient learner graduates each kana track after 12 observed characters
    // with at least 80% last-answer accuracy, without requiring every kana first.
    const kanaReady = (type: "hiragana" | "katakana") => {
      const seen = available.filter((ticket) =>
        entryType(ticket.word) === type && ticket.kind === "meaning" && ticket.state,
      );
      return seen.length >= 12 &&
        seen.filter((ticket) => ticket.state?.last_result === "correct").length / seen.length >= 0.8;
    };
    const hasH = available.some((ticket) => entryType(ticket.word) === "hiragana");
    const hasK = available.some((ticket) => entryType(ticket.word) === "katakana");
    const vocabulary = available.filter((ticket) => entryType(ticket.word) === "word");
    let focus: number;
    if (hasH && !kanaReady("hiragana")) focus = 0;
    else if (hasK && !kanaReady("katakana")) focus = 1;
    else if (!vocabulary.length) focus = hasK ? 1 : 0;
    else {
      const tiers = [...new Set(vocabulary
        .filter((ticket) => ticket.word.source !== "personal")
        .map((ticket) => Math.max(0, Math.min(4, Math.floor(ticket.word.difficulty / 2)))))]
        .sort((a, b) => a - b);
      let current = tiers[0] ?? 0;
      for (const tier of tiers) {
        if (tier > current) break;
        const seen = vocabulary.filter((ticket) =>
          ticket.word.source !== "personal" &&
          Math.floor(ticket.word.difficulty / 2) === tier && ticket.state,
        );
        const correct = seen.filter((ticket) => ticket.state?.last_result === "correct").length;
        if (seen.length >= 12 && correct / seen.length >= 0.8 &&
          tiers.some((next) => next > tier)) {
          current = tiers.find((next) => next > tier)!;
        } else break;
      }
      focus = current + 2;
    }

    const recent = new Set([this.lastWord, ...this.recentWords]);
    const tickets: AutoTicket[] = available.map(({ word, kind, state }) => {
      const type = entryType(word);
      const tier = type === "hiragana" ? 0 :
        type === "katakana" ? 1 :
        word.source === "personal" ? Math.max(2, focus) :
        2 + Math.max(0, Math.min(4, Math.floor(word.difficulty / 2)));
      const distance = tier - focus;
      const match = distance === 0 ? 1 : distance === -1 ? 0.55 :
        distance === 1 ? 0.24 : distance < 0 ? 0.15 : 0.05;
      const bucket = !state ? "exploration" :
        state.last_result !== "correct" || Date.parse(state.due_at) <= now
          ? "review" : "maintenance";
      const overdue = state ? Math.max(0, (now - Date.parse(state.due_at)) / 86_400_000) : 0;
      const urgency = bucket === "review"
        ? 2 + (state?.last_result !== "correct" ? 1 : 0) + Math.min(2, Math.log1p(overdue))
        : 1;
      const prior = recent.has(wordKey(word.source, word.id)) ? 0.08 : 1;
      return { word, kind, bucket, weight: Math.max(0.001, match * urgency * prior) };
    });

    const used = new Set<string>();
    // Mix reviews and fresh encounters when both exist. Fallback to familiar
    // cards whenever either pool is exhausted; never declare a completed set.
    const order: AutoTicket["bucket"][][] = [
      ["review", "exploration", "maintenance"],
      ["exploration", "review", "maintenance"],
      ["review", "exploration", "maintenance"],
      ["exploration", "review", "maintenance"],
      ["review", "exploration", "maintenance"],
    ];
    const rejected = new Set<string>();
    for (const priority of order) {
      let chosen: PlannedQuestion | undefined;
      for (const bucket of priority) {
        const candidates = tickets.filter((ticket) =>
          ticket.bucket === bucket &&
          !used.has(wordKey(ticket.word.source, ticket.word.id)) &&
          !rejected.has(cardKey(ticket.word.source, ticket.word.id, ticket.kind)),
        );
        // Try several alternatives when a word cannot form four unique answers.
        for (let attempt = 0; attempt < Math.min(40, candidates.length); attempt++) {
          if (!candidates.length) break;
          const ticket = draw(candidates, this.rng);
          const idx = candidates.indexOf(ticket);
          candidates.splice(idx, 1);
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
