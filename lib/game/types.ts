import type { Tables } from "@/lib/supabase/database.types";
export type EntryType = "word" | "hiragana" | "katakana";
// The lean catalog omits audit dates/notes; old cache entries may retain them.
// entry_type is optional for older caches; absent means ordinary vocabulary.
export type Word = Omit<
  Tables<"word">,
  "entry_type" | "created_at" | "updated_at" | "note"
> &
  Partial<Pick<Tables<"word">, "created_at" | "updated_at" | "note">> & {
    source?: "personal";
    entry_type?: EntryType;
  };
export const entryType = (word: Pick<Word, "entry_type">): EntryType =>
  word.entry_type ?? "word";
export type Stat = Tables<"word_recent_stat">;
export type Kind = "meaning" | "reading";
export type Result = "correct" | "incorrect" | "timeout";
export type Answer = {
  source?: "word" | "personal";
  selected_source?: "word" | "personal";
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
  options: Word[];
  mode?: "exploration" | "review";
};
