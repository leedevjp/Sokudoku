import test from "node:test";
import assert from "node:assert/strict";
import { personalCopy } from "../lib/notebook/personal-copy";
import type { Tables } from "../lib/supabase/database.types";
test("personal copy preserves separate pronunciation, meaning and difficulty while creating a new identity", () => {
  const source = { id: "source", user_id: "other", term: "実装", kana: "じっそう", hanja_reading: "실장", meaning_ko: "구현", pronunciation_ko: "짓소우", difficulty: 6, has_kanji: true, note: "메모", created_at: "old", deleted_at: null } as unknown as Tables<"word"> & { pronunciation_ko: string };
  const copy = personalCopy(source, "current");
  assert.deepEqual(copy, { user_id: "current", term: "実装", kana: "じっそう", hanja_reading: "실장", meaning_ko: "구현", pronunciation_ko: "짓소우", difficulty: 6, has_kanji: true, note: "메모", entry_type: "word" });
  assert.equal("id" in copy, false);
  assert.equal("created_at" in copy, false);
  assert.equal("deleted_at" in copy, false);
});
