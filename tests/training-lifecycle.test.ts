import test from "node:test";
import assert from "node:assert/strict";
import { RunPersistence } from "../lib/game/phaser/run-persistence";
import { TrainingInput } from "../lib/game/phaser/training-input";
import { TrainingRuntime } from "../lib/game/data/training-runtime";
import type { Word } from "../lib/game/types";
import type { Phase } from "../lib/game/phaser/types";

test("result saving exposes pending, success and failure without changing game rules", async () => {
  const state = new RunPersistence();
  let resolve!: (value: boolean) => void;
  const pending = new Promise<boolean>((done) => {
    resolve = done;
  });
  const draws: boolean[] = [];
  state.save(
    () => pending,
    () => true,
    () => draws.push(state.saving),
  );
  assert.equal(state.saving, true);
  resolve(true);
  await pending;
  assert.equal(state.saved, true);
  assert.deepEqual(draws, [true, false]);
  state.reset();
  assert.equal(state.saved, null);
  state.save(
    async () => {
      throw Error("offline");
    },
    () => true,
    () => {},
  );
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(state.saved, false);
  assert.equal(state.saving, false);
});

test("retry suppresses duplicate requests and releases its lock after failure", async () => {
  const state = new RunPersistence();
  let calls = 0,
    failures = 0;
  let reject!: (reason: Error) => void;
  const pending = new Promise<number>((_resolve, fail) => {
    reject = fail;
  });
  const operation = () => {
    calls++;
    return pending;
  };
  state.retry(
    operation,
    () => assert.fail("unexpected success"),
    () => {
      failures++;
    },
  );
  state.retry(
    operation,
    () => {},
    () => {},
  );
  assert.equal(calls, 1);
  reject(Error("offline"));
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(failures, 1);
  assert.equal(state.retrying, false);
});

test("extracted input retains held-key suppression, correction controls and cleanup", (t) => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const win = new EventTarget(),
    doc = new EventTarget();
  Object.defineProperty(doc, "hidden", { value: true });
  Object.defineProperty(globalThis, "window", {
    value: win,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: doc,
    configurable: true,
  });
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
  let phase: Phase = "play",
    toggles = 0,
    hidden = 0;
  const pressed: number[] = [],
    corrections: number[] = [];
  const input = new TrainingInput({
    phase: () => phase,
    press: (_source, index) => pressed.push(index),
    correct: (index) => corrections.push(index),
    toggleCorrection: () => {
      toggles++;
    },
    pause: () => {
      phase = "paused";
    },
    resume: () => {
      phase = "play";
    },
    hidden: () => {
      hidden++;
      input.clear();
    },
    cancel: () => {},
  });
  const key = (type: string, code: string, repeat = false) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      code: { value: code },
      repeat: { value: repeat },
    });
    win.dispatchEvent(event);
  };
  input.attach();
  key("keydown", "Digit1");
  key("keydown", "Digit1");
  key("keydown", "Digit1", true);
  assert.deepEqual(pressed, [0]);
  key("keyup", "Digit1");
  key("keydown", "Digit1");
  assert.deepEqual(pressed, [0, 0]);
  phase = "correction";
  key("keydown", "Space");
  key("keydown", "Space");
  key("keydown", "Digit2");
  assert.equal(toggles, 1);
  assert.deepEqual(corrections, [1]);
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(hidden, 1);
  input.detach();
  key("keydown", "Digit3");
  assert.deepEqual(corrections, [1]);
});

test("preview runtime keeps learned words across finish and retry without storage or network", async () => {
  const words: Word[] = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    term: "word" + i,
    kana: "かな" + i,
    meaning_ko: "meaning" + i,
    has_kanji: true,
    hanja_reading: null,
    difficulty: 0,
    deleted_at: null,
  }));
  const runtime = new TrainingRuntime({
    levels: null,
    kinds: ["meaning"],
    modes: ["exploration"],
    previewWords: words,
    onLoginRequired: () => assert.fail("unexpected login"),
  });
  const data = await runtime.load(),
    question = data.planner.next()!;
  const answer = {
    id: "answer",
    word_id: question.word.id,
    question_type: question.kind,
    selected_word_id: question.word.id,
    result: "correct" as const,
    response_ms: 500,
    time_limit_ms: 10000,
    answered_at: new Date().toISOString(),
    mode: question.mode,
  };
  data.planner.record(answer, question.word);
  runtime.record(answer);
  assert.equal(await runtime.finish(), true);
  const retry = await runtime.retry();
  assert.equal(retry.planner, data.planner);
  retry.planner.resetSet();
  assert.equal(retry.planner.progress().unseen, 7);
  assert.notEqual(retry.planner.next()?.word.id, question.word.id);
});
