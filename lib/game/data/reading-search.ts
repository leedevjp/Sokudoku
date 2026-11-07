import { entryType, type Word } from "../types";
import { addReading, emptyReadingIndex, normalizedReading, searchReadings, type ReadingIndex } from "../reading-index";
import type { ReadingReply, ReadingRequest } from "../reading-worker";

export class ReadingSearch {
  private worker?: Worker;
  private nextId = 0;
  private pending = new Map<number, { resolve: (reply: ReadingReply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private byReading = new Map<string, Word>();
  private fallback?: ReadingIndex;
  private fallbackReady?: Promise<void>;
  private closed = false;
  async initialize(words: Word[], owner: string) {
    const common: string[] = [], personal: string[] = [];
    for (const word of words) {
      if (word.deleted_at || entryType(word) !== "word") continue;
      const reading = normalizedReading(word.kana);
      if (!reading) continue;
      if (!this.byReading.has(reading)) this.byReading.set(reading, word);
      (word.source === "personal" ? personal : common).push(reading);
    }
    try {
      this.worker = new Worker(new URL("../reading-worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = ({ data }: MessageEvent<ReadingReply>) => {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(data.id);
        if (data.error) pending.reject(Error(data.error)); else pending.resolve(data);
      };
      this.worker.onerror = () => this.fail();
      await this.request({ type: "init", owner, common, personal });
    } catch {
      this.fail();
      await this.buildFallback();
    }
  }
  private async buildFallback() {
    if (this.closed) throw Error("READING_CLOSED");
    if (!this.fallbackReady) this.fallbackReady = (async () => {
      const index = emptyReadingIndex(), readings = [...this.byReading.keys()];
      for (let i = 0; i < readings.length; i++) {
        addReading(index, readings[i]);
        if (i % 64 === 63) await new Promise((resolve) => setTimeout(resolve, 0));
        if (this.closed) throw Error("READING_CLOSED");
      }
      this.fallback = index;
    })();
    await this.fallbackReady;
  }
  private request(message: Omit<Extract<ReadingRequest, { type: "init" }>, "id"> | Omit<Extract<ReadingRequest, { type: "search" }>, "id">) {
    if (this.closed || !this.worker) return Promise.reject<ReadingReply>(Error("READING_CLOSED"));
    const id = ++this.nextId;
    return new Promise<ReadingReply>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error("READING_TIMEOUT")); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ ...message, id });
    });
  }
  async prepare(word: Word) {
    if (word.reading_choices) return;
    if (this.closed) throw Error("READING_CLOSED");
    let readings: string[];
    if (this.fallback) readings = searchReadings([this.fallback], word.kana);
    else {
      try { readings = (await this.request({ type: "search", kana: word.kana })).readings ?? []; }
      catch {
        this.fail(); await this.buildFallback();
        readings = searchReadings([this.fallback!], word.kana);
      }
    }
    word.reading_choices = readings.map((reading) => this.byReading.get(reading)!).filter(Boolean);
  }
  private fail() {
    this.worker?.terminate(); this.worker = undefined;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(Error("READING_WORKER")); }
    this.pending.clear();
  }
  close() { this.closed = true; this.fail(); }
}
