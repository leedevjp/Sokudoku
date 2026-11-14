import assert from "node:assert/strict";
import test from "node:test";
import { ReadingSearch } from "../lib/game/data/reading-search";
import type { Word } from "../lib/game/types";
import type { ReadingRequest } from "../lib/game/reading-worker";

const words = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i), kana: `カナ${i}`, has_kanji: true, deleted_at: null,
  source: i % 2 ? "personal" : undefined,
} as Word));

test("large reading initialization yields to pending UI work before starting its worker", async t => {
  let clock = 0, painted = false;
  t.mock.method(performance, "now", () => (clock += 9));
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let init: Extract<ReadingRequest, { type: "init" }> | undefined;
  class StubWorker {
    onmessage?: (event: { data: { id: number } }) => void;
    constructor() { assert.equal(painted, true, "paint/input work must get a turn first"); }
    postMessage(message: ReadingRequest) {
      if (message.type === "init") init = message;
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id } }));
    }
    terminate() {}
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: StubWorker });
  t.after(() => { if (original) Object.defineProperty(globalThis, "Worker", original); else Reflect.deleteProperty(globalThis, "Worker"); });
  setTimeout(() => { painted = true; }, 0);
  const search = new ReadingSearch();
  await search.initialize(words, "owner");
  assert.equal(init?.common.length, 500);
  assert.equal(init?.personal.length, 500);
  assert.deepEqual(init?.common.slice(0, 3), ["かな0", "かな2", "かな4"]);
  search.close();
});

test("closing while a large reading catalog yields cannot create a late worker", async t => {
  let clock = 0;
  t.mock.method(performance, "now", () => (clock += 9));
  const search = new ReadingSearch();
  setTimeout(() => search.close(), 0);
  await assert.rejects(search.initialize(words, "owner"), /READING_CLOSED/);
});
