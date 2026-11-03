import type { Tables } from "@/lib/supabase/database.types";
export type Word = Tables<"word"> & { source?: "personal" };
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
export type Question = { word: Word; kind: Kind; options: Word[]; mode?: "exploration" | "review" };
