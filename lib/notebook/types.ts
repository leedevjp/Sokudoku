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
> & { entry_type?: string; source: "word" | "personal"; last_incorrect_at: string; in_personal?: boolean; personal_entry?: { id: string; updated_at: string } | null; can_add_personal?: boolean };

export const NOTEBOOK_PAGE_SIZE = 10;
