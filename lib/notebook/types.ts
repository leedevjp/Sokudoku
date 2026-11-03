import type { Tables } from "@/lib/supabase/database.types";

export type NotebookWord = Pick<
  Tables<"word">,
  | "id"
  | "term"
  | "kana"
  | "hanja_reading"
  | "meaning_ko"
  | "note"
  | "difficulty"
> & { source: "word" | "personal"; last_incorrect_at: string };

export const NOTEBOOK_PAGE_SIZE = 10;
