import type { Kind, Word } from "../types";
import type { LearningEngine } from "./engine";
import { wordKey } from "./types";

type ReviewCandidate = { word: Word; kind: Kind; weight: number };

/** Only due or last-failed cards enter review; selection remains probabilistic. */
export function reviewCandidates(
  engine: LearningEngine,
  byKey: ReadonlyMap<string, Word>,
  kinds: Kind[],
  now: number,
): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  for (const state of engine.words.values()) {
    const word = byKey.get(wordKey(state.source, state.word_ref));
    if (
      !word ||
      !kinds.includes(state.question_type) ||
      (state.question_type === "reading" && !word.has_kanji)
    )
      continue;
    const due = Date.parse(state.due_at) <= now;
    const weak = state.last_result !== "correct";
    if (!due && !weak) continue;
    const forgotten = 1 - engine.retrievability(state, now);
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
  return candidates;
}
