import type { Answer, Word } from "../types";
import { flushAnswers, queueAnswer, pendingAnswers } from "./answer-queue";

/** Keeps an in-memory fallback while each answer is durably queued in IndexedDB. */
export class AnswerJournal {
  private answers: Answer[] = [];
  private writes = new Map<string, Promise<void>>();
  private durable = new Set<string>();
  private syncTail: Promise<unknown> = Promise.resolve();
  private localTail: Promise<void> = Promise.resolve();
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
    // A failed IndexedDB read is not an empty learning history. Fail closed
    // so we never start a session using an unknowingly stale state.
    const pending = await this.storage.pendingAnswers(this.owner);
    // Replay the local queue immediately; a slow upload must not gate entry.
    // Share syncTail with later checkpoints so acknowledgement remains serialized.
    if (pending.length && !this.localFirst) void this.sync();
    return pending;
  }
  record(answer: Answer) {
    const entry: Answer = {
      ...answer,
      // Preserve the source of the displayed question even if the catalog
      // changes before its answer is recorded.
      source: answer.source ?? (this.sources.get(answer.word_id) === "personal" ? "personal" : "word"),
      selected_source: answer.selected_source ?? (
        answer.selected_word_id && this.sources.get(answer.selected_word_id) === "personal"
          ? "personal" : "word"
      ),
    };
    this.answers.push(entry);
    if (!this.preview) {
      // Persist immediately, then remember which UUID is already durable.
      // A later checkpoint must not re-insert it after an ACK clears the queue.
      const write = this.storage.queueAnswer(this.owner, entry)
        .then(() => { this.durable.add(entry.id); }, () => {});
      this.writes.set(entry.id, write);
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
  /** Only durable local writes gate navigation; the root worker owns uploads.
   * Serialize checkpoints and exit saves so a late duplicate local write
   * cannot resurrect an answer the worker already acknowledged. */
  saveLocal(): Promise<boolean> {
    if (this.preview) return Promise.resolve(true);
    const work = this.localTail.then(() => this.persistLocal());
    this.localTail = work.then(() => {}, () => {});
    return work;
  }
  private async ensureDurable(batch: Answer[]): Promise<void> {
    await Promise.all(batch.map(answer => this.writes.get(answer.id)));
    // Retry only failed or missing initial writes. Rewriting already-saved
    // UUIDs can resurrect them if the root worker ACKed in the meantime.
    await Promise.all(batch.filter(answer => !this.durable.has(answer.id)).map(async answer => {
      await this.storage.queueAnswer(this.owner, answer);
      this.durable.add(answer.id);
    }));
  }
  private forget(batch: Answer[]) {
    const saved = new Set(batch.map(answer => answer.id));
    this.answers = this.answers.filter(answer => !saved.has(answer.id));
    for (const id of saved) {
      this.writes.delete(id);
      this.durable.delete(id);
    }
  }
  private async persistLocal(): Promise<boolean> {
    const batch = this.answers.slice();
    try {
      await this.ensureDurable(batch);
      this.forget(batch);
      return true;
    } catch { return false; }
  }
  private async save(): Promise<boolean> {
    const batch = this.answers.slice();
    try {
      await this.ensureDurable(batch);
      await this.storage.flushAnswers(this.owner);
      this.forget(batch);
      return true;
    } catch {
      return false;
    }
  }
}
