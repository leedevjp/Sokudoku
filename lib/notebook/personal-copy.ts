import type { Tables } from "@/lib/supabase/database.types";
/** A fresh personal card: never copy source identity, ownership or learning state. */
export function personalCopy(word: Tables<"word"> & { pronunciation_ko?: string | null }, userId: string) {
  return {
    user_id: userId, term: word.term, kana: word.kana,
    meaning_ko: word.meaning_ko, hanja_reading: word.hanja_reading,
    pronunciation_ko: word.pronunciation_ko ?? null, note: word.note,
    difficulty: word.difficulty, has_kanji: word.has_kanji, entry_type: "word" as const,
  };
}
