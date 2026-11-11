import { choiceLabel, MISTAKE_FEEDBACK_MS } from "./rules";
import { entryType, type Question } from "./types";

/** Presentation order follows the question; kana have only one answer. */
export function correctionContent(question: Question) {
  return {
    index: question.options.findIndex(
      (option) => option.id === question.word.id,
    ),
    primary: choiceLabel(question.word, question.kind),
    readingHint: question.word.kana?.trim()
      ? `${question.word.kana.trim().replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))}${question.word.pronunciation_ko?.trim() ? ` [${question.word.pronunciation_ko.trim()}]` : ""}`
      : null,
    secondary:
      entryType(question.word) === "word"
        ? choiceLabel(
            question.word,
            question.kind === "reading" ? "meaning" : "reading",
          )
        : null,
  };
}

/** Visible-time countdown: scene/global pauses simply do not tick this clock. */
export class Correction {
  readonly content: ReturnType<typeof correctionContent>;
  readonly term: string;
  private remaining = MISTAKE_FEEDBACK_MS;
  private completed = false;
  paused = false;
  constructor(question: Question) {
    this.content = correctionContent(question);
    this.term = question.word.term;
  }
  get ratio() {
    return this.remaining / MISTAKE_FEEDBACK_MS;
  }
  tick(delta: number) {
    if (!this.paused && !this.completed && Number.isFinite(delta)) {
      this.remaining = Math.max(0, this.remaining - Math.max(0, delta));
    }
    return this.remaining === 0 && !this.completed;
  }
  toggle() {
    if (!this.completed) this.paused = !this.paused;
  }
  complete(index = this.content.index) {
    if (this.completed || index !== this.content.index) return false;
    this.completed = true;
    return true;
  }
}
