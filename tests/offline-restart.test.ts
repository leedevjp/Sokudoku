import test from "node:test";
import assert from "node:assert/strict";
import { AnswerJournal } from "../lib/game/data/answer-journal";
import { GameDataLoader } from "../lib/game/data/bootstrap";
import { TrainingRuntime } from "../lib/game/data/training-runtime";
import { LearningEngine } from "../lib/game/learning/engine";
import { recoverLearning } from "../lib/game/learning/recovery";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { SyncEngine, type SyncStore, type SyncTransport } from "../lib/sync/engine";
import { emptySnapshot, type QueuedAnswer, type SyncSnapshot } from "../lib/sync/types";
import type { Answer, Word } from "../lib/game/types";

const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i), term: "word" + i, kana: "かな" + i,
  meaning_ko: "meaning" + i, has_kanji: true, hanja_reading: null,
  difficulty: 0, deleted_at: null,
}));
const makeAnswer = (id: string, wordId = "0", source: Answer["source"] = "word"): Answer => ({
  id, word_id: wordId, source, question_type: "meaning",
  selected_word_id: wordId, selected_source: source, result: "correct",
  response_ms: 250, time_limit_ms: 10000, answered_at: "2026-11-15T00:00:00.000Z",
});

test("exit save survives worker crash after server ACK; home instantly replays pending and retry is idempotent", async () => {
  const outbox = new Map<string, QueuedAnswer>();
  const server = new Map<string, QueuedAnswer>();
  const canonical = await LearningEngine.create();
  let snapshot: SyncSnapshot = emptySnapshot("owner");
  let version = 0, failManifest = true, failCommit = false, pushCalls = 0;

  const journalStorage = {
    async queueAnswer(owner: string, answer: Answer) {
      outbox.set(answer.id, { ...answer, owner });
    },
    async pendingAnswers(owner: string) {
      return [...outbox.values()].filter(a => a.owner === owner);
    },
    async flushAnswers() {
      throw Error("direct upload must not be used by local-first exit");
    },
  };
  const journal = new AnswerJournal("owner", words, false, journalStorage, true);
  journal.record(makeAnswer("answer-1"));
  assert.equal(await journal.saveLocal(), true, "exit only completes after the answer is durable");
  assert.equal(outbox.size, 1);

  const store: SyncStore = {
    async read() { return snapshot; },
    async pending() { return [...outbox.values()]; },
    async commit(next, acknowledged) {
      if (failCommit) throw Error("TAB_TERMINATED_DURING_COMMIT");
      // Simulate one IndexedDB readwrite transaction: snapshot + ACK deletion.
      snapshot = next;
      for (const id of acknowledged) outbox.delete(id);
    },
  };
  const transport: SyncTransport = {
    async push(batch) {
      pushCalls++;
      for (const answer of batch) {
        if (server.has(answer.id)) continue;
        server.set(answer.id, answer);
        version++;
        canonical.apply({
          ...answer, source: answer.source === "personal" ? "personal" : "word",
          difficulty: 0,
        });
      }
      return { user_id: "owner", ids: batch.map(a => a.id) };
    },
    async manifest() {
      if (failManifest) throw Error("FORCE_QUIT_AFTER_SERVER_ACK");
      return { owner: "owner", protocol: 1, versions: {
        answers: String(version), learning_states: String(version), learner: String(version),
      } };
    },
    async pull() {
      const learned = canonical.snapshot();
      return { owner: "owner", protocol: 1, versions: {
        answers: String(version), learning_states: String(version), learner: String(version),
      }, changes: [
        ...learned.words.map(state => ({
          dataset: "learning_states" as const, key: state.word_ref + ":" + state.question_type,
          version: String(version), deleted: false,
          value: state as unknown as Record<string, unknown>,
        })),
        { dataset: "learner" as const, key: "self", version: String(version), deleted: false,
          value: learned.learner as unknown as Record<string, unknown> },
      ] };
    },
  };

  // A worker dies after the server persisted the UUID, before it can commit the ACK.
  await assert.rejects(new SyncEngine("owner", store, transport).run(), /FORCE_QUIT/);
  assert.equal(server.size, 1);
  assert.equal(outbox.size, 1, "a server ACK alone must not clear the local outbox");

  // The next app process enters the game from the saved cache, even offline.
  const newProcessJournal = new AnswerJournal("owner", words, false, journalStorage, true);
  const pending = await newProcessJournal.recover();
  const playable = await recoverLearning(undefined, pending, words);
  assert.equal(playable.learner.review_count, 1);
  assert.equal(new TrainingPlanner(playable, words, ["meaning"], ["exploration"]).progress().unseen, 7);

  failManifest = false;
  failCommit = true;
  await assert.rejects(new SyncEngine("owner", store, transport).run(), /TAB_TERMINATED/);
  assert.equal(outbox.size, 1, "a failed local commit must not delete acknowledged answers");

  // Retry with a fresh worker and idempotent UUID. Both the answer log and FSRS stay single-count.
  failCommit = false;
  await new SyncEngine("owner", store, transport).run();
  assert.ok(pushCalls >= 3);
  assert.equal(server.size, 1);
  assert.equal(outbox.size, 0);
  assert.equal(canonical.learner.review_count, 1);
  const synced = {
    learner: snapshot.data.learner.self as unknown as ReturnType<typeof canonical.snapshot>["learner"],
    words: Object.values(snapshot.data.learning_states) as unknown as ReturnType<typeof canonical.snapshot>["words"],
  };
  const afterCrash = await recoverLearning(synced, await newProcessJournal.recover(), words);
  assert.equal(afterCrash.learner.review_count, 1);
  assert.equal(afterCrash.words.get("word:0:meaning")?.last_answer_id, "answer-1");
});

test("home preload uses the atomic worker outbox even if a background ACK clears it before game load", async t => {
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({
    user_id: "owner", words, stats: [], pendingAnswers: [makeAnswer("just-played")],
  }));
  let staleReads = 0;
  t.mock.method(AnswerJournal.prototype, "recover", async () => {
    staleReads++;
    return []; // A separate late read after the worker cleared the outbox.
  });
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({
    levels: "1", kinds: ["meaning"], modes: ["exploration"], onLoginRequired() {},
  });
  const data = await runtime.load();
  assert.equal(staleReads, 0, "never combine an old worker snapshot with a late empty queue read");
  assert.equal(data.planner.engine.learner.review_count, 1);
  assert.equal(data.planner.progress().unseen, 7);
  assert.notEqual(data.planner.next()?.word.id, "0");
  runtime.dispose();
});

test("fully committed server snapshot with an empty atomic outbox keeps the learned card", async t => {
  const canonical = await LearningEngine.create();
  canonical.apply({ ...makeAnswer("saved"), source: "word", difficulty: 0 });
  t.mock.method(GameDataLoader.prototype, "fetchData", async () => ({
    user_id: "owner", words, stats: [], learning: canonical.snapshot(), pendingAnswers: [],
  }));
  t.mock.method(AnswerJournal.prototype, "recover", async () => {
    throw Error("non-atomic late read must not be used");
  });
  t.mock.method(AnswerJournal.prototype, "saveLocal", async () => true);
  const runtime = new TrainingRuntime({
    levels: "1", kinds: ["meaning"], modes: ["exploration"], onLoginRequired() {},
  });
  const data = await runtime.load();
  assert.equal(data.planner.engine.learner.review_count, 1);
  assert.equal(data.planner.progress().unseen, 7);
  runtime.dispose();
});

test("a failed outbox read never silently pretends that pending learning does not exist", async () => {
  const journal = new AnswerJournal("owner", words, false, {
    async queueAnswer() {},
    async pendingAnswers() { throw Error("INDEXEDDB_BLOCKED"); },
    async flushAnswers() {},
  }, true);
  await assert.rejects(journal.recover(), /INDEXEDDB_BLOCKED/);
});

test("exit save cannot resurrect an answer already removed by successful worker ACK", async () => {
  const queue = new Map<string, Answer>();
  let writes = 0;
  const journal = new AnswerJournal("owner", words, false, {
    async queueAnswer(_owner, answer) { writes++; queue.set(answer.id, answer); },
    async pendingAnswers() { return [...queue.values()]; },
    async flushAnswers() {},
  }, true);
  journal.record(makeAnswer("one"));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(queue.size, 1);
  queue.delete("one"); // ACK committed while the game had a pending checkpoint.
  assert.equal(await journal.saveLocal(), true);
  assert.equal(queue.size, 0, "do not rewrite an already durable UUID");
  assert.equal(writes, 1);
});

test("concurrent checkpoint and exit saves serialize; a new answer during saving is not lost", async () => {
  const queue = new Map<string, Answer>();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  const journal = new AnswerJournal("owner", words, false, {
    async queueAnswer(_owner, answer) {
      if (answer.id === "one") { started(); await gate; }
      queue.set(answer.id, answer);
    },
    async pendingAnswers() { return [...queue.values()]; },
    async flushAnswers() {},
  }, true);
  journal.record(makeAnswer("one"));
  const checkpoint = journal.saveLocal();
  await entered;
  journal.record(makeAnswer("two", "1"));
  const exit = journal.saveLocal();
  release();
  assert.deepEqual(await Promise.all([checkpoint, exit]), [true, true]);
  assert.deepEqual([...queue.keys()].sort(), ["one", "two"]);
});

test("source and selected_source remain those of the displayed card even after catalog replacement", async () => {
  let persisted: Answer | undefined;
  const journal = new AnswerJournal("owner", words, false, {
    async queueAnswer(_owner, answer) { persisted = answer; },
    async pendingAnswers() { return persisted ? [persisted] : []; },
    async flushAnswers() {},
  }, true);
  journal.setWords([]); // Old card is still visible but the catalog has refreshed.
  journal.record(makeAnswer("personal-answer", "p", "personal"));
  assert.equal(await journal.saveLocal(), true);
  assert.equal(persisted?.source, "personal");
  assert.equal(persisted?.selected_source, "personal");
});
