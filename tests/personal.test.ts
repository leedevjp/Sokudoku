import test from "node:test";
import assert from "node:assert/strict";
import {
  personalWordInput,
  personalWordUpdate,
  revisionInput,
  wordChanges,
} from "../lib/personal/schema";

const input = {
  term: " 実装 ",
  kana: "ジッソウ",
  meaning_ko: "구현",
  hanja_reading: "실장",
  difficulty: 6,
  note: "",
};
test("personal content is normalized without merging meaning and hanja reading", () => {
  const word = wordChanges(personalWordInput.parse(input));
  assert.equal(word.term, "実装");
  assert.equal(word.kana, "じっそう");
  assert.equal(word.hanja_reading, "실장");
  assert.equal(word.meaning_ko, "구현");
  assert.equal(word.note, null);
  assert.equal(word.has_kanji, true);
});
test("personal input cannot assign ownership, lifecycle or arbitrary fields", () => {
  for (const field of [
    "user_id",
    "id",
    "entry_type",
    "deleted_at",
    "has_kanji",
  ]) {
    assert.equal(
      personalWordInput.safeParse({ ...input, [field]: "injected" }).success,
      false,
    );
  }
  for (const difficulty of [-1, 11, 1.5])
    assert.equal(
      personalWordInput.safeParse({ ...input, difficulty }).success,
      false,
    );
  assert.equal(
    personalWordInput.safeParse({ ...input, kana: "実装" }).success,
    false,
  );
});
test("updates and deletions require an exact revision", () => {
  assert.equal(personalWordUpdate.safeParse(input).success, false);
  assert.equal(
    revisionInput.safeParse({ updated_at: "yesterday" }).success,
    false,
  );
  assert.equal(
    personalWordUpdate.safeParse({
      ...input,
      updated_at: "2026-11-03T12:00:00.123456+00:00",
    }).success,
    true,
  );
});
