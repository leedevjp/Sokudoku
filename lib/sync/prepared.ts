import type { Bootstrap } from "../game/data/bootstrap";
import type { LearningSnapshot, LearningWord, Learner } from "../game/learning/types";
import { withMeaningBank, type MeaningBank } from "../game/meaning-bank";
import { parseLevels, selectedDifficulty, wordMatchesLevels } from "../game/selection";
import { entryType, type Kind, type Word } from "../game/types";
import { catalogVersion, type SyncSnapshot } from "./types";

/** Compose the whole catalog locally; no selected-stage API calls are needed. */
export function preparedGame(snapshot: SyncSnapshot, levelsValue: string | null, kinds: Kind[]): Bootstrap {
  const common = Object.values(snapshot.data.words) as unknown as Word[];
  const personal = Object.values(snapshot.data.personal_words).map(w => ({ ...w, source: "personal" as const })) as unknown as Word[];
  const byId = new Map(common.map(w => [w.id, w]));
  const bank: MeaningBank = {};
  if (kinds.includes("meaning")) {
    for (const raw of Object.values(snapshot.data.distractors)) {
      if (raw.status !== "approved") continue;
      const id = String(raw.target_word_id), candidate = String(raw.candidate_id);
      const word = byId.get(candidate), extra = snapshot.data.extra_choices[candidate];
      if (raw.candidate_source === "word" && word && !word.deleted_at && entryType(word) === "word")
        (bank[id] ??= []).push(["word", candidate, word.meaning_ko, word.hanja_reading]);
      else if (raw.candidate_source === "extra" && extra)
        (bank[id] ??= []).push(["extra", candidate, String(extra.label), null]);
    }
  }
  const levels = parseLevels(levelsValue), difficulties = selectedDifficulty(levels);
  let selected = common.filter(w => wordMatchesLevels(w, levels, difficulties));
  if (kinds.includes("meaning")) selected = withMeaningBank(selected, bank);
  const learning: LearningSnapshot = {
    learner: (snapshot.data.learner.self as unknown as Learner) ?? null,
    words: Object.values(snapshot.data.learning_states) as unknown as LearningWord[],
  };
  return { user_id: snapshot.owner, words: [...selected, ...(levels.includes("P") ? personal : [])],
    stats: [], learning, readingWords: [...common, ...personal], catalogVersion: catalogVersion(snapshot.versions) };
}
