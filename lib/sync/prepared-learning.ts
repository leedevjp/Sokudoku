import type { LearningSnapshot, LearningWord, Learner } from "../game/learning/types";
import { cardKey } from "../game/learning/types";
import type { SyncSnapshot } from "./types";

export type LearningDelta = { baseKey: string; words: LearningWord[]; removed: string[] };
export type LearningPayload = { learning?: LearningSnapshot; learningKey?: string; learningDelta?: LearningDelta };
export type LearningCache = { owner: string; key: string; rows: SyncSnapshot["data"]["learning_states"] };
export type RestoredLearning = { owner: string; key: string; rows: ReadonlyMap<string, LearningWord>; learning: LearningSnapshot };

/** Diff on the data worker; full resets remain valid after cache/owner changes. */
export function prepareLearning(snapshot: SyncSnapshot, knownKey?: string, previous?: LearningCache) {
  const key = JSON.stringify([snapshot.owner, snapshot.versions.learning_states ?? "0", snapshot.versions.learner ?? "0"]);
  const rows = snapshot.data.learning_states;
  const learner = (snapshot.data.learner.self as unknown as Learner) ?? null;
  const cache: LearningCache = { owner: snapshot.owner, key, rows };
  let reply: LearningPayload;
  let ordered = true;
  if (previous?.owner === snapshot.owner && previous.key === knownKey && rows !== previous.rows) {
    const retained = Object.keys(previous.rows).filter(key => key in rows);
    let position = 0, added = false;
    for (const key of Object.keys(rows)) {
      if (!(key in previous.rows)) added = true;
      else if (added || retained[position++] !== key) { ordered = false; break; }
    }
  }
  if (ordered && previous?.owner === snapshot.owner && previous.key === knownKey) {
    const words: LearningWord[] = [], removed: string[] = [];
    for (const [id, row] of Object.entries(rows))
      if (row !== previous.rows[id] && JSON.stringify(row) !== JSON.stringify(previous.rows[id])) words.push(row as unknown as LearningWord);
    for (const [id, raw] of Object.entries(previous.rows)) if (!(id in rows)) {
      const word = raw as unknown as LearningWord;
      removed.push(cardKey(word.source, word.word_ref, word.question_type));
    }
    reply = { learningKey: key, learning: { learner, words: [] }, learningDelta: { baseKey: knownKey!, words, removed } };
  } else reply = { learningKey: key, learning: { learner, words: Object.values(rows) as unknown as LearningWord[] } };
  return { reply, cache };
}

/** Keep immutable row objects across replies; games may share but never mutate them. */
export function restoreLearning(owner: string, reply: LearningPayload, previous?: RestoredLearning): RestoredLearning | undefined {
  if (!reply.learningKey || !reply.learning) return;
  const delta = reply.learningDelta;
  if (delta && (previous?.owner !== owner || previous.key !== delta.baseKey)) throw Error("LEARNING_CACHE_MISS");
  if (delta && !delta.words.length && !delta.removed.length) return { ...previous!, key: reply.learningKey,
    learning: { learner: reply.learning.learner, words: previous!.learning.words } };
  const rows = new Map(delta ? previous!.rows : []);
  if (delta) for (const key of delta.removed) rows.delete(key);
  for (const word of delta?.words ?? reply.learning.words) rows.set(cardKey(word.source, word.word_ref, word.question_type), word);
  return { owner, key: reply.learningKey, rows, learning: { learner: reply.learning.learner, words: [...rows.values()] } };
}
