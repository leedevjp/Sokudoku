import { entryType, type Kind, type Word } from "./types";

export const vocabularyLevels = ["1", "2", "3", "4", "5", "P"] as const;
export const kanaLevels = ["H", "K"] as const;
export const trainingLevels = [...kanaLevels, ...vocabularyLevels] as const;
export type TrainingLevel = (typeof trainingLevels)[number];
export const defaultLevels: TrainingLevel[] = ["1", "2", "3", "4", "5"];
export const levelDifficulty: Record<
  Exclude<TrainingLevel, "P" | "H" | "K">,
  number[]
> = {
  "1": [0, 1],
  "2": [2, 3],
  "3": [4, 5],
  "4": [6, 7],
  "5": [8, 9, 10],
};
export function parseLevels(value: string | null): TrainingLevel[] {
  if (value === null) return [...defaultLevels];
  return trainingLevels.filter((level) => value.split(",").includes(level));
}
export function selectedDifficulty(levels: TrainingLevel[]) {
  return new Set(
    levels.flatMap((level) =>
      level === "P"
        ? []
        : level === "H" || level === "K"
          ? [-1]
          : levelDifficulty[level],
    ),
  );
}

export const trainingKinds: Kind[] = ["reading", "meaning"];
export function parseKinds(value: string | null): Kind[] {
  if (value === null) return [...trainingKinds];
  return trainingKinds.filter((kind) => value.split(",").includes(kind));
}
export function wordsForKinds(words: Word[], kinds: Kind[]): Word[] {
  return words.filter(
    (word) =>
      !word.deleted_at &&
      (kinds.includes("meaning") ||
        (kinds.includes("reading") &&
          entryType(word) === "word" &&
          word.has_kanji)),
  );
}

export function wordMatchesLevels(
  word: Word,
  levels: TrainingLevel[],
  difficulties = selectedDifficulty(levels),
) {
  const type = entryType(word);
  if (type === "hiragana") return levels.includes("H");
  if (type === "katakana") return levels.includes("K");
  return difficulties.has(word.difficulty);
}
