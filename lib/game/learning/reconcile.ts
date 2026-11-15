import type { Bootstrap } from "../data/bootstrap";
import type { Answer, Word } from "../types";
import { cardKey, type LearningSnapshot } from "./types";
import { recoverLearning, replayAnswers } from "./recovery";
import { sameLearningState } from "./equivalent";
import type { LearningEngine } from "./engine";

/** Catch answers recorded while cooperative recovery yielded to UI work. */
export async function recoverLiveLearning(snapshot: LearningSnapshot | undefined, pending: Answer[], played: Answer[], catalog: ReadonlyMap<string, Word>) {
  let count = played.length;
  const engine = await recoverLearning(snapshot, [...pending, ...played], [], { catalog, shareWords: true, cooperative: true });
  while (count < played.length) {
    const extra = played.slice(count); count = played.length;
    await replayAnswers(engine, extra, catalog, true);
  }
  return engine;
}

/** Compare only changed canonical rows and all old/new optimistic overlays. */
export async function equivalentLearningDelta(current: LearningEngine, previous: Bootstrap, fresh: Bootstrap,
  pending: Answer[], played: Answer[], catalog: ReadonlyMap<string, Word>): Promise<boolean> {
  const delta = fresh.learningDelta;
  if (!delta || delta.baseKey !== previous.learningKey || !fresh.learningIndex || !fresh.learning) return false;
  const keys = new Set([...delta.removed, ...delta.words.map(w => cardKey(w.source, w.word_ref, w.question_type))]);
  const include = (answers: Answer[]) => { for (const a of answers) keys.add(cardKey(a.source ?? "word", a.word_id, a.question_type)); };
  include(previous.pendingAnswers ?? []); include(pending); include(played);
  const subset = { learner: fresh.learning.learner,
    words: [...keys].flatMap(key => { const word = fresh.learningIndex!.get(key); return word ? [word] : []; }) };
  const count = played.length;
  const engine = await recoverLiveLearning(subset, pending, played, catalog);
  // A newly answered key might not have been in the subset's canonical base.
  // Recover from the full shared snapshot in this rare race instead.
  if (count !== played.length) return false;
  return sameLearningState(current, engine, keys);
}
