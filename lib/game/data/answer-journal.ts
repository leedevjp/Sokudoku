import type { Answer, Word } from "../types";
import { flushAnswers, queueAnswer } from "./answer-queue";

/** Keeps an in-memory fallback while each answer is durably queued in IndexedDB. */
export class AnswerJournal {
  private answers: Answer[] = [];
  private writes: Promise<unknown>[] = [];
  private sources = new Map<string, Word["source"]>();
  constructor(
    private owner: string,
    words: Word[],
    private preview = false,
  ) {
    this.setWords(words);
  }
  setWords(words: Word[]) {
    this.sources = new Map(words.map((word) => [word.id, word.source]));
  }
  recover() {
    // Recovery must never delay the next game after a killed tab.
    if (!this.preview) void flushAnswers(this.owner).catch(() => {});
  }
  record(answer: Answer) {
    const entry: Answer = {
      ...answer,
      source:
        this.sources.get(answer.word_id) === "personal" ? "personal" : "word",
      selected_source:
        answer.selected_word_id &&
        this.sources.get(answer.selected_word_id) === "personal"
          ? "personal"
          : "word",
    };
    this.answers.push(entry);
    if (!this.preview) {
      const write = queueAnswer(this.owner, entry);
      this.writes.push(write);
      void write.catch(() => {});
    }
  }
  async sync(): Promise<boolean> {
    if (this.preview) return true;
    try {
      await Promise.allSettled(this.writes);
      await Promise.all(
        this.answers.map((answer) => queueAnswer(this.owner, answer)),
      );
      await flushAnswers(this.owner);
      this.answers.length = 0;
      this.writes.length = 0;
      return true;
    } catch {
      return false;
    }
  }
}
