import { type Answer, type Kind, type Question, type Word } from "../types";
import { questionFor } from "../question";
import { trainingKinds } from "../selection";
import { LearningEngine } from "./engine";
import { type TrainingMode, wordKey } from "./types";
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
  }
  next(): PlannedQuestion | null {
    this.ensureSet();
    const question = this.queue.shift() ?? null;
    if (question) {
      this.lastWord = wordKey(question.word.source, question.word.id);
      this.seen.add(this.lastWord);
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
  private *makeSet(): Generator<{ word: Word; kind: Kind }, void, void> {
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
