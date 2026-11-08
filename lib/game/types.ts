import type { Tables } from "@/lib/supabase/database.types";
export type EntryType = "word" | "hiragana" | "katakana";
// The lean catalog omits audit dates/notes; old cache entries may retain them.
// entry_type is optional for older caches; absent means ordinary vocabulary.
export type Word = Pick<
  Tables<"word">,
  "id" | "term" | "kana" | "hanja_reading" | "meaning_ko" | "has_kanji" | "difficulty" | "deleted_at"
> &
  Partial<Pick<Tables<"word">, "created_at" | "updated_at" | "note">> & {
    source?: "personal";
    entry_type?: EntryType;
    meaning_choices?: Choice[];
    reading_choices?: Word[];
  };
/** Extra labels can be selected, but are never words in the learning catalog. */
export type Choice = Pick<Word, "id" | "kana" | "hanja_reading" | "meaning_ko"> & {
  source?: "personal" | "extra";
  entry_type?: EntryType;
};
export const entryType = (word: Pick<Word, "entry_type">): EntryType =>
  word.entry_type ?? "word";
export type Stat = Tables<"word_recent_stat">;
export type Kind = "meaning" | "reading";
export type Result = "correct" | "incorrect" | "timeout";
export type Answer = {
  mode?: "exploration" | "review" | "exam";
  source?: "word" | "personal";
  selected_source?: "word" | "personal" | "extra";
  id: string;
  word_id: string;
  question_type: Kind;
  selected_word_id: string | null;
  result: Result;
  response_ms: number;
  time_limit_ms: number;
  answered_at: string;
};
export type Question = {
  word: Word;
  kind: Kind;
  options: Choice[];
  mode?: "exploration" | "review" | "exam";
};
