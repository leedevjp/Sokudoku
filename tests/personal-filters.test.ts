import test from "node:test";
import assert from "node:assert/strict";
import { stageDifficulties, personalSearchFilter } from "../lib/personal/filters";
import { listInput } from "../lib/personal/schema";
test("personal stages cover the homepage pairs and difficulty ten separately", () => {
  assert.equal(stageDifficulties("all"), null);
  for (const stage of ["1", "2", "3", "4", "5"] as const) assert.deepEqual(stageDifficulties(stage), [(+stage-1)*2, (+stage-1)*2+1]);
  assert.deepEqual(stageDifficulties("10"), [10]);
  assert.equal(listInput.safeParse({stage: "P"}).success, false);
  assert.equal(listInput.safeParse({sort: "unexpected"}).success, false);
});
test("search quotes filter grammar and treats LIKE metacharacters literally", () => {
  assert.ok(personalSearchFilter('a,b').includes('term.ilike."%a,b%"'));
  assert.ok(personalSearchFilter('100%_').includes('100\\\\%\\\\_'));
  assert.ok(personalSearchFilter('a"b').includes('a\\"b'));
  assert.equal(personalSearchFilter('실장').split(',').length, 5);
});
