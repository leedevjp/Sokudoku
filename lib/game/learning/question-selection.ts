import type { Kind, Question, Word } from "../types";
import { questionFor } from "../question";
import { type TrainingMode, wordKey } from "./types";

export type SelectionContext = {
  words: Word[];
  kinds: Kind[];
  lastWord: string | undefined;
  rng: () => number;
};

export type Candidate = { word: Word; kind?: Kind; weight: number };
export type PlannedQuestion = Question & { mode: TrainingMode };
export type PreparationStep = { word: Word; kind: Kind } | null;

export function draw<T extends Candidate>(candidates: T[], rng: () => number): T {
  let n = rng() * candidates.reduce((sum, c) => sum + c.weight, 0);
  for (const candidate of candidates) {
    n -= candidate.weight;
    if (n < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

export function* selectQuestions(
  candidates: Candidate[],
  used: Set<string>,
  mode: Exclude<TrainingMode, "auto">,
  context: SelectionContext,
): Generator<{ word: Word; kind: Kind }, PlannedQuestion[], void> {
  const questions: PlannedQuestion[] = [];
  let remaining = candidates
    .filter((c) => !used.has(wordKey(c.word.source, c.word.id)))
    .map((c) => ({
      ...c,
      weight:
        c.weight *
        (mode === "review" &&
        wordKey(c.word.source, c.word.id) === context.lastWord
          ? 0.05
          : 1),
    }));
  // Bounded retries handle words that cannot form four disjoint choices.
  for (
    let attempt = 0;
    attempt < 64 && remaining.length && questions.length < 5;
    attempt++
  ) {
    const selected = draw(remaining, context.rng);
    const key = wordKey(selected.word.source, selected.word.id);
    remaining = remaining.filter(
      (c) => wordKey(c.word.source, c.word.id) !== key,
    );
    const available = context.kinds.filter(
      (kind) => kind === "meaning" || selected.word.has_kanji,
    );
    const first =
      selected.kind ?? available[Math.floor(context.rng() * available.length)];
    const kinds = selected.kind
      ? [selected.kind]
      : [first, ...available.filter((kind) => kind !== first)];
    for (const kind of kinds) {
      yield { word: selected.word, kind };
      const question = questionFor(selected.word, kind, context.words, context.rng);
      if (question) {
        questions.push({ ...question, mode });
        used.add(key);
        break;
      }
    }
  }
  return questions;
}
