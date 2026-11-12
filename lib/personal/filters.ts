import { levelDifficulty } from "../game/selection";
export const personalStages = ["all", "1", "2", "3", "4", "5", "10"] as const;
export type PersonalStage = typeof personalStages[number];
export const personalSorts = ["recent", "oldest", "reading", "easy", "hard"] as const;
export type PersonalSort = typeof personalSorts[number];
export function stageDifficulties(stage: PersonalStage): number[] | null {
  return stage === "all" ? null : stage === "10" ? [10] : levelDifficulty[stage];
}
// Quote the PostgREST value and escape LIKE wildcards so search stays literal.
export function personalSearchFilter(query: string) {
  const pattern = query.replace(/[\\%_]/g, "\\$&");
  const value = pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return ["term", "kana", "meaning_ko", "pronunciation_ko", "hanja_reading"].map(field => `${field}.ilike."%${value}%"`).join(",");
}
