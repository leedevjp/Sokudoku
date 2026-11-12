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
> & { source: "word" | "personal"; last_incorrect_at: string; in_personal?: boolean; can_add_personal?: boolean };

export const NOTEBOOK_PAGE_SIZE = 10;
