import test from "node:test";
import assert from "node:assert/strict";
import {
  personalWordInput,
  personalWordUpdate,
  revisionInput,
  wordChanges,
} from "../lib/personal/schema";
import {
  partitionAnswers,
  personalReferences,
} from "../lib/game/answer-references";

const input = {
  term: " 実装 ",
  kana: "ジッソウ",
  meaning_ko: "구현",
  hanja_reading: "실장",
  pronunciation_ko: "짓소우",
  difficulty: 6,
  note: "",
};
test("personal content is normalized without merging meaning and hanja reading", () => {
  const word = wordChanges(personalWordInput.parse(input));
  assert.equal(word.term, "実装");
  assert.equal(word.kana, "じっそう");
  assert.equal(word.hanja_reading, "실장");
  assert.equal(word.pronunciation_ko, "짓소우");
  assert.equal(word.meaning_ko, "구현");
  assert.equal(word.note, null);
  assert.equal(word.has_kanji, true);
});
test("Korean phonetic pronunciation is optional and distinct from hanja reading", () => {
  const parsed = personalWordInput.parse({
    ...input,
    pronunciation_ko: "  짓소우  ",
  });
  assert.equal(parsed.pronunciation_ko, "짓소우");
  assert.equal(parsed.hanja_reading, "실장");
  assert.equal(
    personalWordInput.parse({ ...input, pronunciation_ko: "" }).pronunciation_ko,
    null,
  );
  const { pronunciation_ko: unused, ...legacyInput } = input;
  void unused;
  assert.equal(personalWordInput.parse(legacyInput).pronunciation_ko, undefined);
  for (const value of ["ジッソウ", "実装", "jitssou", "<script>", "짓소우\n"]) {
    assert.equal(
      personalWordInput.safeParse({ ...input, pronunciation_ko: value }).success,
      false,
      value,
    );
  }
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

test("markup, invisible controls, malformed Unicode and excessive content are rejected", () => {
  for (const term of [
    "<script>alert(1)</script>",
    "実装\u202e",
    "実\u200b装",
    "実装\0",
    "実装\n",
    "x'); DROP TABLE word; --",
    "__",
    "\\",
    "\ud800",
  ]) {
    assert.equal(
      personalWordInput.safeParse({ ...input, term }).success,
      false,
      term,
    );
  }
  for (const field of ["meaning_ko", "note", "hanja_reading", "pronunciation_ko"] as const) {
    assert.equal(
      personalWordInput.safeParse({
        ...input,
        [field]: "<img src=x onerror=alert(1)>",
      }).success,
      false,
    );
    assert.equal(
      personalWordInput.safeParse({ ...input, [field]: "spoof\u202e" }).success,
      false,
    );
  }
  for (const kana of ["123", "ー・", "かな\nかな", "かな\u0000", "かな💣"]) {
    assert.equal(
      personalWordInput.safeParse({ ...input, kana }).success,
      false,
    );
  }
  for (const [field, max] of [
    ["term", 100],
    ["kana", 200],
    ["meaning_ko", 1000],
    ["note", 4000],
    ["hanja_reading", 100],
    ["pronunciation_ko", 200],
  ] as const) {
    assert.equal(
      personalWordInput.safeParse({ ...input, [field]: "あ".repeat(max + 1) })
        .success,
      false,
    );
  }
});

test("normal words, technical abbreviations and plain-text notes remain usable", () => {
  for (const term of [
    "実装",
    "お金",
    "C++",
    "C#",
    ".NET",
    "API",
    "サーバー",
    "取り扱い",
    "～について",
  ]) {
    assert.equal(
      personalWordInput.safeParse({ ...input, term }).success,
      true,
      term,
    );
  }
  assert.equal(
    personalWordInput.parse({
      ...input,
      kana: "ｼﾞｯｿｳ",
      note: "예시: 구현하기\n実装する / API v2",
    }).kana,
    "じっそう",
  );
});

test("deleted personal references are discarded without dropping unrelated queued answers", () => {
  const answers = [
    { id: "common", word_id: "word", selected_word_id: null },
    {
      id: "present",
      source: "personal" as const,
      word_id: "keep",
      selected_word_id: "keep",
      selected_source: "personal" as const,
    },
    {
      id: "deleted",
      source: "personal" as const,
      word_id: "gone",
      selected_word_id: null,
    },
    {
      id: "selected-deleted",
      word_id: "word",
      selected_source: "personal" as const,
      selected_word_id: "gone",
    },
  ];
  assert.deepEqual(personalReferences(answers), ["keep", "gone"]);
  const { accepted, discarded } = partitionAnswers(answers, new Set(["keep"]));
  assert.deepEqual(
    accepted.map((a) => a.id),
    ["common", "present"],
  );
  assert.deepEqual(
    discarded.map((a) => a.id),
    ["deleted", "selected-deleted"],
  );
});
