import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { TrainingFeedback } from "../lib/game/phaser/training-feedback";
import { CORRECT_FEEDBACK_MS } from "../lib/game/rules";
import { defaultPreferences } from "../lib/game/preferences";
import type { Word } from "../lib/game/types";

const word = { term: "言葉", kana: "ことば" } as Word;
class Utterance {
  lang = "";
  rate = 1;
  onend?: () => void;
  onerror?: () => void;
  constructor(readonly text: string) {}
}
function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const utterances: Utterance[] = [];
  let cancelled = 0;
  let throws = false;
  const synth = {
    cancel() { cancelled++; },
    speak(utterance: Utterance) {
      if (throws) throw Error("VOICE_FAILED");
      utterances.push(utterance);
    },
  };
  for (const [key, value] of [["window", { speechSynthesis: synth }], ["SpeechSynthesisUtterance", Utterance]] as const) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const pending: { milliseconds: number; callback: () => void }[] = [];
  let advances = 0;
  let active = true;
  const feedback = new TrainingFeedback({
    canAdvance: () => active,
    advance: () => { advances++; },
    delay: (milliseconds, callback) => { pending.push({ milliseconds, callback }); },
  });
  return {
    feedback, utterances, pending,
    get advances() { return advances; },
    get cancelled() { return cancelled; },
    pause() { active = false; },
    resume() { active = true; feedback.tryAdvance(); },
    failVoice() { throws = true; },
  };
}

test("feedback waits for both speech and the original delay, and advances once", t => {
  const h = setup(t);
  h.feedback.speak(word, "correct", defaultPreferences, true);
  h.feedback.queue();
  h.feedback.queue();
  assert.equal(h.pending.length, 1);
  assert.equal(h.pending[0].milliseconds, CORRECT_FEEDBACK_MS);
  h.pending[0].callback();
  assert.equal(h.advances, 0);
  h.utterances[0].onend!();
  h.utterances[0].onerror!();
  h.feedback.tryAdvance();
  assert.equal(h.advances, 1);
});

test("speech completing first still waits for feedback delay", t => {
  const h = setup(t);
  h.feedback.speak(word, "correct", defaultPreferences, true);
  h.feedback.queue();
  h.utterances[0].onend!();
  assert.equal(h.advances, 0);
  h.pending[0].callback();
  assert.equal(h.advances, 1);
});

test("pause and mute cancel speech without advancing until the scene permits it", t => {
  const h = setup(t);
  h.feedback.speak(word, "incorrect", defaultPreferences, true);
  h.feedback.queue();
  h.pause();
  h.feedback.stopSpeech();
  h.pending[0].callback();
  h.utterances[0].onend!();
  assert.equal(h.feedback.speaking, false);
  assert.equal(h.advances, 0);
  h.resume();
  assert.equal(h.advances, 1);
});

test("callbacks from a cancelled word cannot release a newer word's speech gate", t => {
  const h = setup(t);
  h.feedback.speak(word, "correct", defaultPreferences, true);
  const stale = h.utterances[0].onend!;
  h.feedback.reset();
  h.feedback.speak(word, "incorrect", defaultPreferences, true);
  h.feedback.queue();
  h.pending[0].callback();
  stale();
  assert.equal(h.feedback.speaking, true);
  assert.equal(h.advances, 0);
  h.utterances[1].onend!();
  assert.equal(h.advances, 1);
});

test("voice watchdog and synchronous voice errors do not trap the quiz", t => {
  const h = setup(t);
  h.feedback.speak(word, "timeout", defaultPreferences, true);
  h.feedback.queue();
  h.pending[0].callback();
  t.mock.timers.tick(7999);
  assert.equal(h.advances, 0);
  t.mock.timers.tick(1);
  assert.equal(h.advances, 1);
  assert.equal(h.feedback.speaking, false);
  h.feedback.reset();
  h.failVoice();
  h.feedback.speak(word, "incorrect", defaultPreferences, true);
  h.feedback.queue();
  h.pending[1].callback();
  assert.equal(h.advances, 2);
});

test("speech preserves preference suppression, kana selection and voice settings", t => {
  const h = setup(t);
  h.feedback.speak(word, "correct", { ...defaultPreferences, pronunciation: "wrong" }, true);
  h.feedback.speak(word, "incorrect", { ...defaultPreferences, pronunciation: "off" }, true);
  h.feedback.speak(word, "incorrect", defaultPreferences, false);
  assert.equal(h.utterances.length, 0);
  h.feedback.speak(word, "incorrect", { ...defaultPreferences, pronunciationSource: "kana" }, true);
  assert.equal(h.utterances[0].text, word.kana);
  assert.equal(h.utterances[0].lang, "ja-JP");
  assert.equal(h.utterances[0].rate, 0.95);
  h.feedback.stopSpeech();
  assert.ok(h.cancelled >= 1);
});
