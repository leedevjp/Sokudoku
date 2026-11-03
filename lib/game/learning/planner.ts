import {
  entryType,
  type Answer,
  type Kind,
  type Question,
  type Word,
} from "../types";
import { questionFor } from "../question";
import { trainingKinds } from "../selection";
import { LearningEngine } from "./engine";
import { type TrainingMode, wordKey } from "./types";

type Candidate = { word: Word; kind?: Kind; weight: number };
export type PlannedQuestion = Question & { mode: TrainingMode };

/** Positive Gaussian mixture. Equal difficulty buckets avoid vocabulary-count bias. */
export function explorationWeights(
  words: Word[],
  ability: number,
  precision: number,
  reviews: number,
) {
  const ordinary = words.filter((word) => entryType(word) === "word");
  const categories = new Set(words.map(entryType));
  const categoryShare = 1 / categories.size;
  const counts = new Map<number, number>();
  for (const word of ordinary)
    counts.set(word.difficulty, (counts.get(word.difficulty) ?? 0) + 1);
  const sigma = Math.max(1.2, Math.min(3.5, 1 + Math.sqrt(1 / precision)));
  const curve = new Map(
    [...counts.keys()].map((d) => [
      d,
      Math.exp(-0.5 * ((d - ability) / sigma) ** 2),
    ]),
  );
  const sum = [...curve.values()].reduce((a, b) => a + b, 0);
  const weighted = ordinary.map((word) => ({
    word,
    weight:
      (reviews < 20
        ? 1 / counts.size
        : 0.1 / counts.size + (0.9 * curve.get(word.difficulty)!) / sum) /
      counts.get(word.difficulty)!,
  }));
  const kanaCounts = new Map<string, number>();
  for (const word of words)
    if (entryType(word) !== "word")
      kanaCounts.set(
        entryType(word),
        (kanaCounts.get(entryType(word)) ?? 0) + 1,
      );
  return [
    ...weighted.map((item) => ({
      ...item,
      weight: item.weight * categoryShare,
    })),
    ...words
      .filter((word) => entryType(word) !== "word")
      .map((word) => ({
        word,
        weight: categoryShare / kanaCounts.get(entryType(word))!,
      })),
  ];
}
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
  constructor(
    readonly engine: LearningEngine,
    private words: Word[],
    private kinds: Kind[] = trainingKinds,
    private modes: TrainingMode[] = ["exploration", "review"],
    private rng: () => number = Math.random,
  ) {
    this.byKey = new Map(
      words.map((word) => [wordKey(word.source, word.id), word]),
    );
  }
  resetSet() {
    this.queue = [];
    this.lastWord = undefined;
  }
  next(): PlannedQuestion | null {
    if (!this.queue.length) this.makeSet();
    const question = this.queue.shift() ?? null;
    if (question)
      this.lastWord = wordKey(question.word.source, question.word.id);
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
          (wordKey(c.word.source, c.word.id) === this.lastWord ? 0.05 : 1),
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
    const candidates: Candidate[] = [];
    for (const state of this.engine.words.values()) {
      const word = this.byKey.get(wordKey(state.source, state.word_ref));
      if (
        !word ||
        !this.kinds.includes(state.question_type) ||
        (state.question_type === "reading" && !word.has_kanji)
      )
        continue;
      const due = Date.parse(state.due_at) <= now;
      const weak = state.last_result !== "correct";
      if (!due && !weak) continue;
      const forgotten = 1 - this.engine.retrievability(state, now);
      const overdue = Math.max(
        0,
        (now - Date.parse(state.due_at)) / 86_400_000,
      );
      candidates.push({
        word,
        kind: state.question_type,
        weight:
          0.05 +
          forgotten +
          (weak ? 0.5 : 0) +
          Math.min(2, Math.log1p(overdue)),
      });
    }
    const review = this.modes.includes("review")
      ? this.select(candidates, used, "review")
      : [];
    const learner = this.engine.learner;
    const exploration = this.modes.includes("exploration")
      ? this.select(
          explorationWeights(
            this.words,
            learner.ability,
            learner.precision,
            learner.ability_count ?? learner.review_count,
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
