import assert from "node:assert/strict";
import test from "node:test";
import { choiceLabel } from "../lib/game/rules";

test("yen meanings omit the hanja reading in quiz choices", () => {
  const labels = [
    ["십원", "10엔"],
    ["일원", "1엔"],
    ["삼원", "3엔"],
    ["천원", "1,000엔"],
    ["원", "엔(일본의 화폐 단위)"],
    [null, "12엔"],
  ] as const;
  for (const [hanja_reading, meaning_ko] of labels) {
    assert.equal(choiceLabel({ kana: "", hanja_reading, meaning_ko }, "meaning"), meaning_ko);
  }
});

test("yen formatting preserves reading questions and other meanings", () => {
  assert.equal(choiceLabel({ kana: "じゅうえん", hanja_reading: "십원", meaning_ko: "10엔" }, "reading"), "じゅうえん");
  assert.equal(choiceLabel({ kana: "", hanja_reading: "십원", meaning_ko: "10원" }, "meaning"), "십원(10원)");
  assert.equal(choiceLabel({ kana: "えんかつな", hanja_reading: "원활", meaning_ko: "순조로운" }, "meaning"), "원활(순조로운)");
});
