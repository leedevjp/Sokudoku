import type { Bootstrap } from "../game/data/bootstrap";
import type { LearningSnapshot, LearningWord, Learner } from "../game/learning/types";
import { withMeaningBank, type MeaningBank } from "../game/meaning-bank";
import { parseLevels, selectedDifficulty, wordMatchesLevels } from "../game/selection";
import { entryType, type Kind, type Word } from "../game/types";
import { catalogVersion, type SyncSnapshot, type SyncRow } from "./types";
import type { LearningPayload } from "./prepared-learning";

// applyPacket and readLocalSync preserve unchanged dataset references. Cache
// indexes by those immutable maps, so learning-only syncs never rebuild them.
const commonIndexes = new WeakMap<object, { words: Word[]; byId: Map<string, Word> }>();
const distractorIndexes = new WeakMap<object, Map<string, SyncRow[]>>();
function commonIndex(rows: SyncSnapshot["data"]["words"]) {
  let index = commonIndexes.get(rows);
  if (!index) {
    const words = Object.values(rows) as unknown as Word[];
    index = { words, byId: new Map(words.map(word => [word.id, word])) };
    commonIndexes.set(rows, index);
  }
  return index;
}
function distractorIndex(rows: SyncSnapshot["data"]["distractors"]) {
  let index = distractorIndexes.get(rows);
  if (!index) {
    index = new Map();
    for (const raw of Object.values(rows)) {
      if (raw.status !== "approved") continue;
      const id = String(raw.target_word_id);
      const candidates = index.get(id);
      if (candidates) candidates.push(raw);
      else index.set(id, [raw]);
    }
    distractorIndexes.set(rows, index);
  }
  return index;
}

/** Compose the whole catalog locally; no selected-stage API calls are needed. */
export function preparedGame(snapshot: SyncSnapshot, levelsValue: string | null, kinds: Kind[], knownCatalogKey?: string, learningReply?: LearningPayload): Bootstrap {
  const catalogKey = JSON.stringify([snapshot.owner, catalogVersion(snapshot.versions), parseLevels(levelsValue), kinds]);
  const learning = learningReply ?? { learning: {
    learner: (snapshot.data.learner.self as unknown as Learner) ?? null,
    words: Object.values(snapshot.data.learning_states) as unknown as LearningWord[],
  } satisfies LearningSnapshot };
  if (knownCatalogKey === catalogKey) return {
    user_id: snapshot.owner, words: [], stats: [], ...learning,
    catalogVersion: catalogVersion(snapshot.versions), syncVersion: snapshot.savedAt,
    catalogKey, catalogUnchanged: true,
  };
  const { words: common, byId } = commonIndex(snapshot.data.words);
  const levels = parseLevels(levelsValue), difficulties = selectedDifficulty(levels);
  const needsReading = kinds.includes("reading");
  const personal = levels.includes("P") || needsReading
    ? Object.values(snapshot.data.personal_words).map(w => ({ ...w, source: "personal" as const })) as unknown as Word[]
    : [];
  let selected = common.filter(w => wordMatchesLevels(w, levels, difficulties));
  const bank: MeaningBank = {};
  if (kinds.includes("meaning") && selected.some(word =>
    entryType(word) === "word" && word.difficulty >= 0 && word.difficulty <= 9)) {
    const candidates = distractorIndex(snapshot.data.distractors);
    for (const target of selected) for (const raw of candidates.get(target.id) ?? []) {
      const id = String(raw.target_word_id), candidate = String(raw.candidate_id);
      const word = byId.get(candidate), extra = snapshot.data.extra_choices[candidate];
      if (raw.candidate_source === "word" && word && !word.deleted_at && entryType(word) === "word")
        (bank[id] ??= []).push(["word", candidate, word.meaning_ko, word.hanja_reading]);
      else if (raw.candidate_source === "extra" && extra)
        (bank[id] ??= []).push(["extra", candidate, String(extra.label), null]);
    }
  }
  if (kinds.includes("meaning")) selected = withMeaningBank(selected, bank);
  return { user_id: snapshot.owner, words: [...selected, ...(levels.includes("P") ? personal : [])],
    stats: [], ...learning, catalogKey, ...(needsReading ? { readingWords: [...common, ...personal] } : {}), catalogVersion: catalogVersion(snapshot.versions), syncVersion: snapshot.savedAt };
}
