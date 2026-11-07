import type { Answer, Kind, Stat, Word } from "../types";
import type { TrainingMode } from "../learning/types";
import { LearningEngine } from "../learning/engine";
import { recoverLearning } from "../learning/recovery";
import { TrainingPlanner } from "../learning/planner";
import { wordsForKinds } from "../selection";
import { AnswerJournal } from "./answer-journal";
import { GameDataLoader, type Bootstrap } from "./bootstrap";
import { database, storageDeadline } from "./database";
import { ReadingSearch } from "./reading-search";

export type TrainingData = {
  words: Word[];
  stats: Stat[];
  planner: TrainingPlanner;
};
type RuntimeOptions = {
  levels: string | null;
  kinds: Kind[];
  modes: TrainingMode[];
  previewWords?: Word[];
  onLoginRequired: () => void;
};

/** Owns data loading, local recovery and persistence; knows nothing about React or Phaser. */
export class TrainingRuntime {
  private loader: GameDataLoader;
  private data!: Bootstrap;
  private planner!: TrainingPlanner;
  private journal!: AnswerJournal;
  private ended = false;
  private reading?: ReadingSearch;
  private disposed = false;

  constructor(private options: RuntimeOptions) {
    this.loader = new GameDataLoader(options.levels, options.onLoginRequired, options.kinds.includes("meaning"), options.kinds.includes("reading"));
  }
  private filter(data: Bootstrap): Bootstrap {
    return { ...data, words: wordsForKinds(data.words, this.options.kinds) };
  }
  private current(): TrainingData {
    return {
      words: this.data.words,
      stats: this.data.stats,
      planner: this.planner,
    };
  }
  private plan(engine: LearningEngine, data = this.data, reading = this.reading) {
    return new TrainingPlanner(
      engine,
      data.words,
      this.options.kinds,
      this.options.modes,
      undefined,
      reading ? async (word, kind) => { if (kind === "reading") await reading.prepare(word); } : undefined,
    );
  }
  private async createReading(data: Bootstrap): Promise<ReadingSearch | undefined> {
    if (this.options.previewWords || !this.options.kinds.includes("reading")) return;
    if (this.disposed) throw Error("READING_CLOSED");
    const reading = new ReadingSearch();
    try {
      await reading.initialize(data.readingWords ?? data.words, data.user_id);
      if (this.disposed) throw Error("READING_CLOSED");
    } catch (error) { reading.close(); throw error; }
    // A new catalog snapshot invalidates every previous per-word candidate result.
    for (const word of data.words) delete word.reading_choices;
    return reading;
  }
  dispose() { this.disposed = true; this.reading?.close(); }
  async load(): Promise<TrainingData> {
    const { previewWords, kinds, modes } = this.options;
    if (!kinds.length) throw Error("KINDS");
    if (!modes.length) throw Error("MODES");
    let data: Bootstrap;
    if (previewWords)
      data = { words: previewWords, stats: [], user_id: "preview" };
    else {
      try {
        data = await this.loader.fetchData();
      } catch (error) {
        if ((error as Error).message === "LOGIN") throw error;
        data = await this.loader.loadOffline();
      }
    }
    this.data = this.filter(data);
    const owner = this.data.user_id;
    this.journal = new AnswerJournal(owner, this.data.words, !!previewWords);
    const pending = await this.journal.recover();
    if (pending.length && !previewWords) {
      try {
        const fresh = this.filter(await this.loader.fetchData());
        if (fresh.user_id !== owner) throw Error("LOGIN");
        this.data = fresh;
        this.journal.setWords(fresh.words);
      } catch (error) {
        if ((error as Error).message === "LOGIN") throw error;
        // Replay the durable local queue when the canonical snapshot is unavailable.
      }
    }
    if (!this.data.words.length) throw Error("WORDS");
    const engine = await recoverLearning(
      this.data.learning,
      pending,
      this.data.words,
    );
    if (pending.length) {
      try {
        await storageDeadline(
          (await database()).put(
            "cache",
            engine.snapshot(),
            "learning-v1:" + owner,
          ),
        );
      } catch {
        /* The durable answer queue remains the fallback. */
      }
    }
    this.reading = await this.createReading(this.data);
    this.planner = this.plan(engine);
    await this.planner.prepareSet();
    this.planner.hasQuestions();
    return this.current();
  }
  record(answer: Answer) {
    this.journal.record(answer);
  }
  finish(): Promise<boolean> {
    this.ended = true;
    return this.journal.sync();
  }
  online() {
    if (this.ended) void this.journal.sync();
  }
  async retry(): Promise<TrainingData> {
    this.ended = false;
    if (this.options.previewWords) return { ...this.current(), stats: [] };
    if (!(await this.journal.sync())) return { ...this.current(), stats: [] };
    try {
      const fresh = this.filter(await this.loader.fetchData());
      if (fresh.user_id !== this.data.user_id) {
        this.options.onLoginRequired();
        throw Error("LOGIN");
      }
      const reading = await this.createReading(fresh);
      let planner: TrainingPlanner;
      try {
        planner = this.plan(await LearningEngine.create(fresh.learning), fresh, reading);
        await planner.prepareSet();
      } catch (error) { reading?.close(); throw error; }
      this.reading?.close();
      this.reading = reading;
      this.data = fresh;
      this.journal.setWords(fresh.words);
      this.planner = planner;
      return this.current();
    } catch {
      return { ...this.current(), stats: [] };
    }
  }
}
