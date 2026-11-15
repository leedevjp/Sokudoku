import type { Answer, Word } from "../types";
import { LearningEngine } from "./engine";
import { cardKey, wordKey, type LearningSnapshot } from "./types";
import { WorkBudget } from "./work-budget";

/** Replay unacknowledged local answers without applying canonical answers twice. */
export async function recoverLearning(
  snapshot: LearningSnapshot | undefined,
  pending: Answer[],
  words: Word[],
  options: { shareWords?: boolean; cooperative?: boolean; catalog?: ReadonlyMap<string, Word> } = {},
) {
  const engine = await LearningEngine.create(snapshot, options);
  const catalog = options.catalog ?? new Map(words.map((word) => [wordKey(word.source, word.id), word]));
  await replayAnswers(engine, pending, catalog, options.cooperative);
  return engine;
}

export async function replayAnswers(engine: LearningEngine, pending: Answer[], catalog: ReadonlyMap<string, Word>, cooperative = false) {
  const budget = cooperative ? new WorkBudget() : undefined;
  const sorted = [...pending].sort((a, b) =>
    Date.parse(a.answered_at) - Date.parse(b.answered_at) || a.id.localeCompare(b.id));
  for (const [i, answer] of sorted.entries()) {
    if (i % 128 === 127 && budget?.exhausted()) await budget.yield();
    const source = answer.source === "personal" ? "personal" : "word";
    const word = catalog.get(wordKey(source, answer.word_id));
    if (!word) continue;
    const previous = engine.words.get(cardKey(source, answer.word_id, answer.question_type));
    if (previous && (
      Date.parse(previous.last_review_at) > Date.parse(answer.answered_at) ||
      (Date.parse(previous.last_review_at) === Date.parse(answer.answered_at) && previous.last_answer_id >= answer.id)
    )) continue;
    engine.apply({ ...answer, source, difficulty: word.difficulty });
  }
}
