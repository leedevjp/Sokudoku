import {
  type Answer,
  type Kind,
  type Question,
  type Word,
} from "../types";
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
  constructor(
    readonly engine: LearningEngine,
    private words: Word[],
    private kinds: Kind[] = trainingKinds,
    private modes: TrainingMode[] = ["exploration", "review"],
    private rng: () => number = cryptoRandom,
  ) {
    this.byKey = new Map(
      words.map((word) => [wordKey(word.source, word.id), word]),
    );
  }
  resetSet() {
    this.queue = [];
    this.lastWord = undefined;
    this.seen.clear();
  }
  next(): PlannedQuestion | null {
    if (!this.queue.length) this.makeSet();
    const question = this.queue.shift() ?? null;
    if (question) {
      this.lastWord = wordKey(question.word.source, question.word.id);
      this.seen.add(this.lastWord);
    }
    return question;
  }
  hasQuestions() {
    if (!this.queue.length) this.makeSet();
    return this.queue.length > 0;
  }
  record(answer: Answer, word: Word) {
    this.engine.apply({
      ...answer,
      source: word.source ?? "word",
      difficulty: word.difficulty,
    });
  }
  private select(
    candidates: Candidate[],
    used: Set<string>,
    mode: TrainingMode,
  ) {
    const questions: PlannedQuestion[] = [];
    let remaining = candidates
      .filter((c) => !used.has(wordKey(c.word.source, c.word.id)))
      .map((c) => ({
        ...c,
        weight:
          c.weight *
          (mode === "review" && wordKey(c.word.source, c.word.id) === this.lastWord
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
  private makeSet() {
    const now = Date.now(),
      used = new Set<string>();
    const candidates = reviewCandidates(this.engine, this.byKey, this.kinds, now);
    const review = this.modes.includes("review")
      ? this.select(candidates, used, "review")
      : [];
    const known = new Set(this.seen);
    for (const state of this.engine.words.values())
      known.add(wordKey(state.source, state.word_ref));
    const exploration = this.modes.includes("exploration")
      ? this.select(
          explorationWeights(
            this.words.filter(
              (word) => !known.has(wordKey(word.source, word.id)),
            ),
          ),
          used,
          "exploration",
        )
      : [];
    for (let i = 0; i < Math.max(exploration.length, review.length); i++) {
      if (exploration[i]) this.queue.push(exploration[i]);
      if (review[i]) this.queue.push(review[i]);
    }
  }
}
