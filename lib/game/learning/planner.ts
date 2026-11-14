import type { Answer, Kind, Word } from "../types";
import { trainingKinds } from "../selection";
import type { LearningEngine } from "./engine";
import { type TrainingMode, wordKey } from "./types";
import { explorationWeights } from "./exploration";
import { reviewCandidates } from "./review";
import { cryptoRandom } from "./random";
import { makeAutoSet, type AutoReviewBudget } from "./auto-set";
import { selectQuestions, type PlannedQuestion } from "./question-selection";
export type { PlannedQuestion } from "./question-selection";

// Preserve the existing public import used by callers and regression tests.
export { explorationWeights } from "./exploration";

/** Frozen questions stay stable until displayed; a fresh sync replaces queued questions at the next transition. */
export class TrainingPlanner {
  private queue: PlannedQuestion[] = [];
  private readonly byKey: Map<string, Word>;
  private lastWord: string | undefined;
  private seen = new Set<string>();
  private recentWords: string[] = [];
  private autoBudget: AutoReviewBudget = { carry: 0 };
  private prepared = false;
  private preparing?: Promise<void>;
  private generation = 0;
  private readonly encounters = new Map<string, number>();
  private stagedCatalog?: { words: Word[]; prepare?: (word: Word, kind: Kind) => Promise<void>; applied?: () => void; engine?: LearningEngine };
  stageCatalog(words: Word[], prepare?: (word: Word, kind: Kind) => Promise<void>, applied?: () => void, engine?: LearningEngine) {
    this.stagedCatalog = { words, prepare, applied, engine };
  }
  discardStagedCatalog() {
    this.stagedCatalog = undefined;
  }
  private adoptCatalog() {
    // The current question has already left the queue. Discard only the
    // undisplayed questions, regardless of how many remain in the old set.
    if (!this.stagedCatalog || this.preparing) return;
    const next = this.stagedCatalog;
    this.stagedCatalog = undefined;
    this.generation++;
    this.queue = [];
    this.prepared = false;
    this.words = next.words;
    this.byKey.clear();
    for (const word of this.words) this.byKey.set(wordKey(word.source, word.id), word);
    this.prepareQuestion = next.prepare;
    if (next.engine) {
      this.engine = next.engine;
      for (const state of next.engine.words.values()) {
        const key = wordKey(state.source, state.word_ref);
        this.encounters.set(key, Math.max(this.encounters.get(key) ?? 0, state.card.reps));
      }
    }
    next.applied?.();
  }
  constructor(
    public engine: LearningEngine,
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
    this.autoBudget.carry = 0;
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
    this.adoptCatalog();
    if (this.queue.length || this.prepared) return;
    if (this.prepareQuestion) throw Error("SET_NOT_PREPARED");
    for (const request of this.makeSet()) void request;
    this.prepared = true;
  }
  /** Select first, then prepare only those questions. Never precompute the catalog. */
  async prepareSet(): Promise<void> {
    // Finish an in-flight old preparation before replacing it. Never return
    // an undisplayed old question after a newer snapshot is already staged.
    if (this.preparing) {
      await this.preparing;
      return this.prepareSet();
    }
    this.adoptCatalog();
    if (!this.prepareQuestion) { this.ensureSet(); return; }
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
    const event = { ...answer, source: word.source ?? ("word" as const), difficulty: word.difficulty };
    this.engine.apply(event);
    // Answering the visible old question must also update the incoming engine.
    // Otherwise switching at the next question would erase that answer.
    if (this.stagedCatalog?.engine && this.stagedCatalog.engine !== this.engine)
      this.stagedCatalog.engine.apply(event);
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
  private *makeSet(): Generator<{ word: Word; kind: Kind }, void, void> {
    if (this.modes.includes("auto")) {
      yield* makeAutoSet({
        words: this.words, kinds: this.kinds, lastWord: this.lastWord, rng: this.rng,
        engine: this.engine, byKey: this.byKey, recentWords: this.recentWords,
        queue: this.queue, budget: this.autoBudget,
      });
      return;
    }
    if (this.modes.includes("exam")) {
      // No learned/due/ability filtering: each word has exactly one ticket.
      // Each frozen five-question set is unique; later sets can repeat words.
      const exam = yield* selectQuestions(
        explorationWeights(this.words),
        new Set(),
        "exam",
        { words: this.words, kinds: this.kinds, lastWord: this.lastWord, rng: this.rng },
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
      ? yield* selectQuestions(
          candidates, used, "review",
          { words: this.words, kinds: this.kinds, lastWord: this.lastWord, rng: this.rng },
        )
      : [];
    const known = new Set(this.seen);
    for (const state of this.engine.words.values())
      known.add(wordKey(state.source, state.word_ref));
    const unseen = this.words.filter(
      (word) => !known.has(wordKey(word.source, word.id)),
    );
    const exploration = this.modes.includes("exploration")
      ? yield* selectQuestions(
          explorationWeights(unseen), used, "exploration",
          { words: this.words, kinds: this.kinds, lastWord: this.lastWord, rng: this.rng },
        )
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
