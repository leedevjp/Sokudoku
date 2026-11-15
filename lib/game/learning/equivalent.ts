import type { LearningEngine } from "./engine";

/** Server revision bookkeeping does not affect scheduling. Subsets require a verified canonical base. */
export function sameLearningState(current: LearningEngine, incoming: LearningEngine, keys?: Iterable<string>): boolean {
  const a = current.learner, b = incoming.learner;
  if (a.ability !== b.ability || a.precision !== b.precision ||
      a.review_count !== b.review_count || a.ability_count !== b.ability_count ||
      a.last_answered_at !== b.last_answered_at || a.last_answer_id !== b.last_answer_id ||
      a.model_version !== b.model_version || (!keys && current.words.size !== incoming.words.size)) return false;
  for (const key of keys ?? current.words.keys()) {
    const word = current.words.get(key), next = incoming.words.get(key);
    if (!word || !next) { if (word !== next) return false; continue; }
    if (word.last_answer_id !== next.last_answer_id || word.last_review_at !== next.last_review_at ||
        word.due_at !== next.due_at || word.last_result !== next.last_result || word.model_version !== next.model_version) return false;
    const card = next.card as Record<string, unknown>, fields = Object.entries(word.card);
    if (fields.length !== Object.keys(card).length ||
        fields.some(([name, value]) => !Object.prototype.hasOwnProperty.call(card, name) || card[name] !== value)) return false;
  }
  return true;
}
