import type { Kind, Word } from "./types";

export const trainingLevels = ["1", "2", "3", "4", "5", "P"] as const;
export type TrainingLevel = (typeof trainingLevels)[number];
export const defaultLevels: TrainingLevel[] = ["1", "2", "3", "4", "5"];
export const levelDifficulty: Record<Exclude<TrainingLevel, "P">, number[]> = {
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
    levels.flatMap((level) => (level === "P" ? [] : levelDifficulty[level])),
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
        (kinds.includes("reading") && word.has_kanji)),
  );
}
