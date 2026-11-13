import test from "node:test";
import assert from "node:assert/strict";
import { AnswerJournal } from "../lib/game/data/answer-journal";
import { TrainingRuntime } from "../lib/game/data/training-runtime";
import { GameDataLoader } from "../lib/game/data/bootstrap";
import type { Answer, Word } from "../lib/game/types";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const answer = (id: string, result: Answer["result"] = "correct"): Answer => ({
  id, word_id: "word", question_type: "meaning", result,
  selected_word_id: result === "timeout" ? null : "word",
  response_ms: 100, time_limit_ms: 10000, answered_at: new Date().toISOString(),
});

test("checkpoint preserves answers recorded during upload even when their durable write fails", async () => {
  const queued = new Map<string, Answer>();
  const uploaded: string[][] = [];
  let release!: () => void;
  let offline = false;
  const storage = {
    async queueAnswer(_owner: string, a: Answer) {
      if (offline) throw Error("storage unavailable");
      queued.set(a.id, a);
    },
    async pendingAnswers() { return [...queued.values()]; },
    async flushAnswers() {
      uploaded.push([...queued.keys()]);
      queued.clear();
      if (uploaded.length === 1) await new Promise<void>(resolve => { release = resolve; });
    },
  };
  const journal = new AnswerJournal("owner", [], false, storage);
  journal.record(answer("first"));
  const first = journal.sync();
  await tick();
  offline = true;
  journal.record(answer("second"));
  await tick();
  const second = journal.sync();
  assert.equal(uploaded.length, 1, "overlapping saves wait for the first upload");
  offline = false;
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(uploaded, [["first"], ["second"]]);
});

test("failed checkpoint retains the complete batch for a later retry", async () => {
  let offline = true;
  const queued = new Map<string, Answer>();
  const received = new Set<string>();
  const journal = new AnswerJournal("owner", [], false, {
    async queueAnswer(_owner: string, a: Answer) { queued.set(a.id, a); },
    async pendingAnswers() { return [...queued.values()]; },
    async flushAnswers() {
      if (offline) throw Error("offline");
      for (const id of queued.keys()) received.add(id);
      queued.clear();
    },
  });
  journal.record(answer("one"));
  assert.equal(await journal.sync(), false);
  journal.record(answer("two"));
  offline = false;
  assert.equal(await journal.sync(), true);
  assert.deepEqual([...received], ["one", "two"]);
});

test("live training saves each five answered questions, reconnects and partial exits", async t => {
  const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
    id: "word" + i, term: "word" + i, kana: "かな" + i,
    meaning_ko: "meaning" + i, has_kanji: true, hanja_reading: null,
    difficulty: 0, deleted_at: null,
  }));
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({ words, stats: [], user_id: "owner" }));
  t.mock.method(AnswerJournal.prototype, "recover", async () => []);
  const recorded: Answer[] = [];
  t.mock.method(AnswerJournal.prototype, "record", (a: Answer) => { recorded.push(a); });
  let saves = 0, notices = 0, success = true;
  t.mock.method(AnswerJournal.prototype, "sync", async () => { saves++; return success; });
  const runtime = new TrainingRuntime({ levels: "1", kinds: ["meaning"], modes: ["exploration"],
    onLoginRequired: () => assert.fail("unexpected login"), onAnswersSaved: () => { notices++; } });
  await runtime.load();
  for (let i = 0; i < 4; i++) runtime.record(answer(String(i)));
  runtime.record(answer("timeout", "timeout"));
  await tick();
  assert.equal(saves, 0);
  runtime.record(answer("fifth", "incorrect"));
  await tick();
  assert.equal(saves, 1);
  assert.equal(notices, 1);
  assert.equal(recorded.length, 6, "timeouts remain learning history but do not count toward rewards");
  success = false;
  for (let i = 0; i < 5; i++) runtime.record(answer("next" + i));
  await tick();
  assert.equal(notices, 1, "failed uploads never claim a saved reward");
  success = true;
  runtime.online();
  await tick();
  assert.equal(notices, 2);
  runtime.record(answer("partial"));
  runtime.dispose();
  await tick();
  assert.equal(saves, 4);
  assert.equal(notices, 2, "unmounted games do not display notices");
});
