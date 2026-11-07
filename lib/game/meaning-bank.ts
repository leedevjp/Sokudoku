import { entryType, type Choice, type Word } from "./types";

// Bump this release when approved candidate content changes.
export const MEANING_BANK_VERSION = "2026-11-07-v1";
export type MeaningBank = Record<string, ["word" | "extra", string, string, string | null][]>;

export function withMeaningBank(words: Word[], bank: MeaningBank): Word[] {
  return words.map((word) => {
    if (word.source === "personal" || entryType(word) !== "word" ||
        word.difficulty < 0 || word.difficulty > 9) return word;
    const rows = bank[word.id];
    if (!rows || rows.length < 6 || rows.length > 20) throw Error("MEANING_BANK");
    const meaning_choices: Choice[] = rows.map(([source, id, meaning_ko, hanja_reading]) => ({
      id, meaning_ko, hanja_reading, kana: "",
      ...(source === "extra" ? { source: "extra" as const } : {}),
    }));
    return { ...word, meaning_choices };
  });
}
