import type { Preferences } from "../preferences";
import type { Result, Word } from "../types";
import { CORRECT_FEEDBACK_MS } from "../rules";

type FeedbackActions = {
  canAdvance: () => boolean;
  advance: () => void;
  delay: (milliseconds: number, callback: () => void) => void;
};

/** Owns speech and feedback gates; the scene still owns phases and its paused clock. */
export class TrainingFeedback {
  private speechActive = false;
  private speechToken = 0;
  private speechWatchdog?: ReturnType<typeof setTimeout>;
  private feedbackReady = false;
  private feedbackQueued = false;

  constructor(private actions: FeedbackActions) {}

  get speaking() { return this.speechActive; }

  reset() {
    this.stopSpeech();
    this.feedbackReady = false;
    this.feedbackQueued = false;
  }

  stopSpeech() {
    this.speechToken++;
    this.speechActive = false;
    if (this.speechWatchdog) clearTimeout(this.speechWatchdog);
    this.speechWatchdog = undefined;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  speak(word: Word, result: Result, prefs: Preferences, enabled: boolean) {
    this.stopSpeech();
    if (!enabled || prefs.pronunciation === "off" ||
        (prefs.pronunciation === "wrong" && result === "correct") ||
        !("speechSynthesis" in window)) return;
    const value = prefs.pronunciationSource === "kana" ? word.kana : word.term;
    if (!value?.trim()) return;
    const token = ++this.speechToken;
    this.speechActive = true;
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "ja-JP";
    utterance.rate = 0.95;
    const done = () => {
      if (token !== this.speechToken) return;
      this.speechActive = false;
      if (this.speechWatchdog) clearTimeout(this.speechWatchdog);
      this.speechWatchdog = undefined;
      this.tryAdvance();
    };
    utterance.onend = done;
    utterance.onerror = done;
    // Browser voices can fail to emit completion events. Never trap the quiz.
    this.speechWatchdog = setTimeout(() => { window.speechSynthesis.cancel(); done(); }, 8000);
    try { window.speechSynthesis.speak(utterance); } catch { done(); }
  }
  tryAdvance() {
    if (!this.actions.canAdvance() || !this.feedbackReady || this.speechActive) return;
    this.feedbackReady = false;
    this.actions.advance();
  }
  queue() {
    if (this.feedbackQueued) return;
    this.feedbackQueued = true;
    this.actions.delay(CORRECT_FEEDBACK_MS, () => {
      this.feedbackReady = true;
      this.tryAdvance();
    });
  }
}
