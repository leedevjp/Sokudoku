import type { Tables } from "@/lib/supabase/database.types";
export type PersonalWord = Omit<Tables<"personal_word">, "user_id">;
export type PersonalWordList = {
  words: PersonalWord[];
  total: number;
  all_total: number;
  page: number;
  page_size: number;
};
export type PersonalError =
  | "unauthorized"
  | "duplicate"
  | "invalid_input"
  | "stale"
  | "not_found"
  | "load_failed"
  | "save_failed";
