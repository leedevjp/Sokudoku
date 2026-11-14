import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type Phaser from "phaser";
import { AnswerGate, START_INPUT_DELAY_MS } from "../lib/game/rules";
import { TrainingSession } from "../lib/game/session";
import type { Question } from "../lib/game/types";
import type { TrainingPlanner } from "../lib/game/learning/planner";
import type { TrainingView } from "../lib/game/phaser/board";
import { TrainingState } from "../lib/game/phaser/training-state";
import { TrainingViewport } from "../lib/game/phaser/training-viewport";

function setup(t: TestContext) {
  let now = 92500;
  t.mock.method(performance, "now", () => now);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = { hidden: false };
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "document", previous); else Reflect.deleteProperty(globalThis, "document"); });
  const state = new TrainingState();
  Object.assign(state, { phase: "play", started: 90000, question: { word: { id: "current" } } as Question });
  const session = new TrainingSession();
  const gate = new AnswerGate(); gate.open();
  const calls: string[] = [];
  const rendered: (() => void)[] = [];
  const clock = { paused: false, removeAllEvents: () => { calls.push("clearTimers"); } };
  const scene = {
    time: clock,
    tweens: { pauseAll: () => { calls.push("pauseTweens"); }, resumeAll: () => { calls.push("resumeTweens"); }, killAll: () => { calls.push("clearTweens"); } },
    game: { events: { once: (_name: string, callback: () => void) => { rendered.push(callback); } } },
  } as unknown as Phaser.Scene;
  let correction = false, timed = true;
  let prepare = async () => {};
  const nextQuestion = { word: { id: "next" } } as Question;
  const planner = { prepareSet: () => prepare(), next: () => nextQuestion } as unknown as TrainingPlanner;
  const view = { drawTime: () => { calls.push("drawTime"); }, seconds: { setText: () => {} } } as unknown as TrainingView;
  const viewport = new TrainingViewport(scene, state, session, gate, view, {
    planner: () => planner, timeLimited: () => timed, hasCorrection: () => correction,
    stopSound: () => { calls.push("stopSound"); }, cancelPress: () => { gate.cancel(); calls.push("cancelPress"); },
    closePause: () => { calls.push("closePause"); }, drawPause: () => { calls.push("drawPause"); },
    drawBoard: () => { state.viewGeneration++; calls.push("drawBoard"); },
    drawCorrection: () => { calls.push("drawCorrection"); }, drawEnd: () => { calls.push("drawEnd"); },
    syncCamera: () => { calls.push("syncCamera"); }, feedbackReady: () => { calls.push("feedbackReady"); },
    finish: () => { calls.push("finish"); }, error: () => { calls.push("error"); },
  });
  return { state, session, gate, calls, clock, rendered, viewport, document, nextQuestion,
    at(value: number) { now = value; }, correction(value: boolean) { correction = value; },
    untimed() { timed = false; }, prepare(value: () => Promise<void>) { prepare = value; },
  };
}

test("pause during preparation defers the pause without changing the clock or phase", t => {
  const h = setup(t); h.state.preparingQuestion = true;
  h.viewport.pause();
  assert.equal(h.state.pauseRequested, true);
  assert.equal(h.state.phase, "play");
  assert.equal(h.clock.paused, false);
  assert.deepEqual(h.calls, ["stopSound"]);
});

test("pause and resume preserve response time and suppress input throughout the grace period", t => {
  const h = setup(t); h.viewport.pause();
  assert.equal(h.state.pauseAt, 92500);
  h.at(100000); h.viewport.resume();
  assert.equal(h.state.phase, "settling");
  assert.equal(h.state.settleElapsed, 2500);
  assert.equal(h.gate.claim("tap", 0), false);
  h.at(100000 + START_INPUT_DELAY_MS - 1);
  assert.equal(h.viewport.update(), false);
  h.at(100000 + START_INPUT_DELAY_MS);
  assert.equal(h.viewport.update(), true);
  assert.equal(h.state.phase, "play");
  assert.equal(h.state.started, 98000);
  assert.equal(h.clock.paused, false);
  assert.equal(h.gate.claim("tap", 0), true);
});

test("active resize keeps the same question and elapsed time until the new board renders", async t => {
  const h = setup(t), question = h.state.question;
  await h.viewport.resize();
  assert.equal(h.state.question, question);
  assert.equal(h.state.phase, "arming");
  assert.equal(h.state.resizeElapsed, 2500);
  h.rendered.shift()!();
  assert.equal(h.state.phase, "settling");
  assert.equal(h.state.settleElapsed, 2500);
  assert.equal(h.gate.claim("tap", 0), false);
});

test("correction redraw preserves local correction pause and never prepares another question", async t => {
  const h = setup(t); h.correction(true); h.state.phase = "paused";
  h.prepare(async () => { assert.fail("must not prepare during correction resize"); });
  await h.viewport.resize();
  assert.equal(h.state.phase, "paused");
  assert.equal(h.state.beforePause, "correction");
  assert.ok(h.calls.includes("drawCorrection"));
  assert.ok(h.calls.includes("drawPause"));
  h.viewport.resume();
  assert.equal(h.state.afterSettle, "correction");
});

test("viewport changes during impact and feedback never clear their timers or consume questions", async t => {
  const h = setup(t);
  for (const phase of ["flight", "feedback"] as const) {
    h.state.phase = phase; h.calls.length = 0;
    await h.viewport.resize();
    assert.deepEqual(h.calls, ["syncCamera"]);
    h.state.phase = "paused"; h.state.beforePause = phase; h.calls.length = 0;
    await h.viewport.resize();
    assert.deepEqual(h.calls, ["syncCamera", "drawPause"]);
  }
});

test("a stale async viewport preparation cannot replace a newer run's question", async t => {
  const h = setup(t); h.state.phase = "settling"; h.state.afterSettle = "feedback";
  let release!: () => void;
  h.prepare(() => new Promise<void>(resolve => { release = resolve; }));
  const current = h.state.question;
  const resizing = h.viewport.resize();
  assert.equal(h.state.preparingQuestion, true);
  h.state.nextGeneration++;
  release(); await resizing;
  assert.equal(h.state.question, current);
  assert.ok(!h.calls.includes("drawBoard"));
});

test("viewport preparation errors follow the existing end/error transition", async t => {
  const h = setup(t); h.state.phase = "settling"; h.state.afterSettle = "feedback";
  h.prepare(async () => { throw Error("QUESTION_BUILD_FAILED"); });
  await h.viewport.resize();
  assert.equal(h.state.phase, "end");
  assert.equal(h.state.preparingQuestion, false);
  assert.ok(h.calls.includes("error"));
});

test("a redraw superseded before postrender cannot reopen input", async t => {
  const h = setup(t); await h.viewport.resize();
  h.state.viewGeneration++; h.rendered.shift()!();
  assert.equal(h.state.phase, "arming");
  assert.equal(h.gate.claim("tap", 0), false);
});

test("hidden-tab restoration pauses timed games but keeps untimed games resumable", async t => {
  const h = setup(t); h.document.hidden = true;
  await h.viewport.resize(); h.rendered.shift()!();
  assert.equal(h.state.phase, "paused");
  h.state.phase = "play"; h.untimed();
  await h.viewport.resize(); h.rendered.shift()!();
  assert.equal(h.state.phase, "settling");
});
