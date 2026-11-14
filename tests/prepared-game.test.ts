import assert from "node:assert/strict";
import test from "node:test";
import { preparedGame } from "../lib/sync/prepared";
import { applyPacket, emptySnapshot } from "../lib/sync/types";

function catalog() {
  const snapshot = emptySnapshot("owner");
  snapshot.savedAt = 1;
  snapshot.versions = { words: "1", personal_words: "1", distractors: "1", extra_choices: "1" };
  for (let i = 0; i < 10; i++) snapshot.data.words[String(i)] = {
    id: String(i), term: `語${i}`, kana: `ご${i}`, meaning_ko: `뜻${i}`,
    hanja_reading: null, difficulty: i, has_kanji: true, deleted_at: null,
  };
  snapshot.data.personal_words.p = { ...snapshot.data.words[0], id: "p", term: "個人", difficulty: 10 };
  snapshot.data.extra_choices.e = { label: "추가 선택지" };
  for (let i = 0; i < 10; i++) {
    for (let j = 1; j <= 8; j++) snapshot.data.distractors[`${i}:${j}`] = {
      target_word_id: String(i), candidate_id: String((i + j) % 10), candidate_source: "word", status: "approved",
    };
    snapshot.data.distractors[`${i}:extra`] = { target_word_id: String(i), candidate_id: "e", candidate_source: "extra", status: "approved" };
  }
  return snapshot;
}

test("meaning-only preparation returns selected stages without transferring an unused reading catalog", () => {
  const result = preparedGame(catalog(), "1", ["meaning"]);
  assert.deepEqual(result.words.map(w => w.id), ["0", "1"]);
  assert.equal(result.readingWords, undefined);
  assert.equal(result.words[0].meaning_choices?.length, 9);
  assert.equal(result.words[0].meaning_choices?.at(-1)?.meaning_ko, "추가 선택지");
});

test("reading preparation keeps all unselected common and personal candidates", () => {
  const snapshot = catalog();
  const reading = preparedGame(snapshot, "1", ["reading"]);
  assert.deepEqual(reading.words.map(w => w.id), ["0", "1"]);
  assert.equal(reading.readingWords?.length, 11);
  assert.equal(reading.readingWords?.at(-1)?.source, "personal");
  const mixed = preparedGame(snapshot, "1", ["meaning", "reading"]);
  assert.deepEqual(mixed.words, preparedGame(snapshot, "1", ["meaning"]).words);
  assert.deepEqual(mixed.readingWords, reading.readingWords);
});

test("learning-only updates reuse catalog indexes and still expose current learning", () => {
  const snapshot = catalog(); let examined = 0;
  for (const raw of Object.values(snapshot.data.distractors))
    Object.defineProperty(raw, "status", { get: () => { examined++; return "approved"; } });
  const initial = preparedGame(snapshot, "1", ["meaning"]), before = examined;
  const updated = applyPacket(snapshot, {
    owner: "owner", protocol: 1, versions: { ...snapshot.versions, learning_states: "1" },
    changes: [{ dataset: "learning_states", key: "new", version: "1", deleted: false, value: { word_ref: "0" } }],
  });
  const current = preparedGame(updated, "1", ["meaning"]);
  assert.deepEqual(current.words, initial.words);
  assert.equal(current.learning?.words.length, 1);
  assert.ok(before > 0);
  assert.equal(examined, before, "an unchanged bank must not be scanned again");
});

test("word edits and deletions invalidate candidate lookups without changing bank ordering", () => {
  const snapshot = catalog(); preparedGame(snapshot, "1", ["meaning"]);
  const updated = applyPacket(snapshot, {
    owner: "owner", protocol: 1, versions: { ...snapshot.versions, words: "2" },
    changes: [
      { dataset: "words", key: "1", version: "2", deleted: false, value: { ...snapshot.data.words[1], meaning_ko: "수정된 뜻" } },
      { dataset: "words", key: "2", version: "2", deleted: true, value: null },
    ],
  });
  const choices = preparedGame(updated, "1", ["meaning"]).words[0].meaning_choices!;
  assert.equal(choices[0].meaning_ko, "수정된 뜻");
  assert.ok(choices.every(c => c.id !== "2"));
});

test("bank approval and extra-label updates cannot leave cached choices stale", () => {
  const snapshot = catalog(); preparedGame(snapshot, "1", ["meaning"]);
  const updated = applyPacket(snapshot, {
    owner: "owner", protocol: 1, versions: { ...snapshot.versions, distractors: "2", extra_choices: "2" },
    changes: [
      { dataset: "distractors", key: "0:1", version: "2", deleted: false, value: { ...snapshot.data.distractors["0:1"], status: "rejected" } },
      { dataset: "extra_choices", key: "e", version: "2", deleted: false, value: { label: "수정된 추가 선택지" } },
    ],
  });
  const choices = preparedGame(updated, "1", ["meaning"]).words[0].meaning_choices!;
  assert.ok(choices.every(c => c.id !== "1"));
  assert.equal(choices.at(-1)?.meaning_ko, "수정된 추가 선택지");
});

test("personal-only scope and owner changes cannot reuse another owner's personal entries", () => {
  const first = catalog();
  assert.equal(preparedGame(first, "P", ["meaning"]).words[0].term, "個人");
  const second = { ...first, owner: "other", data: { ...first.data, personal_words: { q: { ...first.data.personal_words.p, id: "q", term: "別の個人" } } } };
  const result = preparedGame(second, "P", ["meaning"]);
  assert.equal(result.user_id, "other");
  assert.deepEqual(result.words.map(w => w.id), ["q"]);
  assert.equal(result.words[0].source, "personal");
});

test("a caller modifying prepared choices cannot corrupt the next preparation", () => {
  const snapshot = catalog();
  preparedGame(snapshot, "1", ["meaning"]).words[0].meaning_choices![0].meaning_ko = "변경";
  assert.equal(preparedGame(snapshot, "1", ["meaning"]).words[0].meaning_choices![0].meaning_ko, "뜻1");
});
import { restorePreparedCatalog } from "../lib/sync/prepared-catalog";

test("matching catalog token transfers only fresh learning and reuses the existing catalog", () => {
  const snapshot = catalog();
  const initial = preparedGame(snapshot, "1", ["meaning"]);
  const updated = applyPacket(snapshot, {
    owner: "owner", protocol: 1, versions: { ...snapshot.versions, learning_states: "1" },
    changes: [{ dataset: "learning_states", key: "new", version: "1", deleted: false, value: { word_ref: "0" } }],
  });
  const reply = preparedGame(updated, "1", ["meaning"], initial.catalogKey);
  assert.equal(reply.catalogUnchanged, true);
  assert.deepEqual(reply.words, []);
  assert.equal(reply.readingWords, undefined);
  const restored = restorePreparedCatalog(reply, { ...initial, catalogKey: initial.catalogKey! });
  assert.equal(restored.words, initial.words);
  assert.equal(restored.learning?.words.length, 1);
  assert.equal(restored.syncVersion, updated.savedAt);
  assert.equal(restored.catalogUnchanged, undefined);
});

test("owner, level, kind and vocabulary revision changes always transfer a fresh catalog", () => {
  const snapshot = catalog(), initial = preparedGame(snapshot, "1", ["meaning"]);
  for (const reply of [
    preparedGame(snapshot, "2", ["meaning"], initial.catalogKey),
    preparedGame(snapshot, "1", ["reading"], initial.catalogKey),
    preparedGame({ ...snapshot, owner: "other" }, "1", ["meaning"], initial.catalogKey),
    preparedGame({ ...snapshot, versions: { ...snapshot.versions, words: "2" } }, "1", ["meaning"], initial.catalogKey),
  ]) {
    assert.equal(reply.catalogUnchanged, undefined);
    assert.ok(reply.words.length > 0);
    assert.notEqual(reply.catalogKey, initial.catalogKey);
  }
});

test("a compact response cannot be restored with a missing, foreign or stale catalog", () => {
  const snapshot = catalog(), initial = preparedGame(snapshot, "1", ["meaning"]);
  const reply = preparedGame(snapshot, "1", ["meaning"], initial.catalogKey);
  const cached = { ...initial, catalogKey: initial.catalogKey! };
  assert.throws(() => restorePreparedCatalog(reply), /CATALOG_CACHE_MISS/);
  assert.throws(() => restorePreparedCatalog(reply, { ...cached, user_id: "other" }), /CATALOG_CACHE_MISS/);
  assert.throws(() => restorePreparedCatalog(reply, { ...cached, catalogKey: "stale" }), /CATALOG_CACHE_MISS/);
});
