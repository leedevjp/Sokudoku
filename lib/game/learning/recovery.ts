import type { Answer, Word } from "../types";
import { LearningEngine } from "./engine";
import { cardKey, wordKey, type LearningSnapshot } from "./types";

/** Replay unacknowledged local answers without applying canonical answers twice. */
export async function recoverLearning(
  snapshot: LearningSnapshot | undefined,
  pending: Answer[],
  words: Word[],
) {
  const engine = await LearningEngine.create(snapshot);
  const catalog = new Map(words.map((word) => [wordKey(word.source, word.id), word]));
  const sorted = [...pending].sort((a, b) =>
    Date.parse(a.answered_at) - Date.parse(b.answered_at) || a.id.localeCompare(b.id));
  for (const answer of sorted) {
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
  return engine;
}
