import type { Answer, Word } from "../types";
import { flushAnswers, queueAnswer, pendingAnswers } from "./answer-queue";

/** Keeps an in-memory fallback while each answer is durably queued in IndexedDB. */
export class AnswerJournal {
  private answers: Answer[] = [];
  private writes: Promise<unknown>[] = [];
  private syncTail: Promise<unknown> = Promise.resolve();
  private sources = new Map<string, Word["source"]>();
  constructor(
    private owner: string,
    words: Word[],
    private preview = false,
    private storage = { queueAnswer, flushAnswers, pendingAnswers },
    private localFirst = false,
  ) {
    this.setWords(words);
  }
  setWords(words: Word[]) {
    this.sources = new Map(words.map((word) => [word.id, word.source]));
  }
  async recover(): Promise<Answer[]> {
    if (this.preview) return [];
    const pending = await this.storage.pendingAnswers(this.owner).catch(() => []);
    // Replay the local queue immediately; a slow upload must not gate entry.
    // Share syncTail with later checkpoints so acknowledgement remains serialized.
    if (pending.length && !this.localFirst) void this.sync();
    return pending;
  }
  record(answer: Answer) {
    const entry: Answer = {
      ...answer,
      source:
        this.sources.get(answer.word_id) === "personal" ? "personal" : "word",
      selected_source:
        answer.selected_source === "extra" ? "extra" :
        answer.selected_word_id &&
        this.sources.get(answer.selected_word_id) === "personal"
          ? "personal"
          : "word",
    };
    this.answers.push(entry);
    if (!this.preview) {
      const write = this.storage.queueAnswer(this.owner, entry);
      this.writes.push(write);
      void write.catch(() => {});
    }
  }
  sync(): Promise<boolean> {
    if (this.preview) return Promise.resolve(true);
    // A checkpoint and the result screen can save concurrently. Serialize them,
    // and retain answers recorded while an earlier upload is still in flight.
    const save = this.syncTail.then(() => this.save());
    this.syncTail = save;
    return save;
  }
  /** Only durable local writes gate navigation; the root worker owns uploads. */
  async saveLocal(): Promise<boolean> {
    if (this.preview) return true;
    const batch = this.answers.slice(), writes = this.writes.splice(0);
    try {
      await Promise.allSettled(writes);
      await Promise.all(batch.map(answer => this.storage.queueAnswer(this.owner, answer)));
      const durable = new Set(batch.map(a => a.id));
      this.answers = this.answers.filter(a => !durable.has(a.id));
      return true;
    } catch { return false; }
  }
  private async save(): Promise<boolean> {
    const batch = this.answers.slice();
    const writes = this.writes.splice(0);
    try {
      await Promise.allSettled(writes);
      await Promise.all(batch.map((answer) => this.storage.queueAnswer(this.owner, answer)));
      await this.storage.flushAnswers(this.owner);
      const saved = new Set(batch.map((answer) => answer.id));
      this.answers = this.answers.filter((answer) => !saved.has(answer.id));
      return true;
    } catch {
      return false;
    }
  }
}
