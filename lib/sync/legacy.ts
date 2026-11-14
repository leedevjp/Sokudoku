import { database } from "../game/data/database";
import type { WordCache } from "../game/data/word-cache";
import type { Bootstrap } from "../game/data/bootstrap";
import { emptyLearning, type LearningSnapshot } from "../game/learning/types";
import { MEANING_BANK_VERSION, withMeaningBank, type MeaningBank } from "../game/meaning-bank";
import { parseLevels, selectedDifficulty, wordMatchesLevels } from "../game/selection";
import { entryType, type Kind } from "../game/types";

/** Existing installations can play their old cache while the first full sync runs. */
export async function readLegacyGame(owner: string, levelsValue: string | null, kinds: Kind[]): Promise<Bootstrap | undefined> {
  const levels = parseLevels(levelsValue), difficulties = selectedDifficulty(levels);
  const bankLevels = levels.filter(l => /^[1-5]$/.test(l)).join(",");
  const tx = (await database()).transaction("cache", "readonly");
  const [common, personal, learning, bank] = await Promise.all([
    tx.store.get("word-sync-v1") as Promise<WordCache | undefined>,
    tx.store.get(`personal-word-v1:${owner}`) as Promise<WordCache | undefined>,
    tx.store.get(`learning-v1:${owner}`) as Promise<LearningSnapshot | undefined>,
    tx.store.get(`meaning-bank:${MEANING_BANK_VERSION}:${bankLevels}`) as Promise<MeaningBank | undefined>,
  ]);
  await tx.done;
  if ((difficulties.size || kinds.includes("reading")) && !common) return;
  if (levels.includes("P") && !personal) return;
  let selected = (common?.words ?? []).filter(w => wordMatchesLevels(w, levels, difficulties));
  if (kinds.includes("meaning") && selected.some(w => entryType(w) === "word" && w.difficulty >= 0)) {
    if (!bank) return;
    try { selected = withMeaningBank(selected, bank); } catch { return; }
  }
  const own = (personal?.words ?? []).filter(w => !w.deleted_at).map(w => ({ ...w, source: "personal" as const }));
  return { user_id: owner, words: [...selected, ...(levels.includes("P") ? own : [])], stats: [],
    learning: learning ?? emptyLearning(), readingWords: [...(common?.words ?? []).filter(w => !w.deleted_at), ...own] };
}
