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
import { kickSync } from "@/lib/sync/client";

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
  onAnswersSaved?: () => void;
};

/** Owns data loading, local recovery and persistence; knows nothing about React or Phaser. */
export class TrainingRuntime {
  private loader: GameDataLoader;
  private data!: Bootstrap;
  private planner!: TrainingPlanner;
  private journal!: AnswerJournal;
  private solvedSinceSave = 0;
  private reading?: ReadingSearch;
  private disposed = false;
  private catalogGeneration = 0;
  private catalogFlight?: Promise<void>;
  private wantedCatalog?: string;
  private stagedVersion?: string;
  private stagedReading?: ReadingSearch;
  private synced = (event: Event) => {
    if (this.disposed || this.options.previewWords) return;
    this.options.onAnswersSaved?.();
    const version = (event as CustomEvent<{ catalogVersion?: string }>).detail?.catalogVersion;
    if (version) this.wantedCatalog = version;
    if (version && version !== this.data?.catalogVersion && version !== this.stagedVersion)
      void this.refreshCatalog();
  };

  constructor(private options: RuntimeOptions) {
    this.loader = new GameDataLoader(options.levels, options.onLoginRequired, options.kinds.includes("meaning"), options.kinds.includes("reading"));
    if (typeof window !== "undefined") window.addEventListener("sokudoku-sync-updated", this.synced);
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
  dispose() {
    this.disposed = true;
    this.catalogGeneration++;
    if (typeof window !== "undefined") window.removeEventListener("sokudoku-sync-updated", this.synced);
    this.reading?.close();
    this.stagedReading?.close();
    // Navigation must also save a partial group of fewer than five answers.
    if (this.journal) void this.journal.saveLocal().then(() => kickSync());
  }
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
    this.journal = new AnswerJournal(owner, this.data.words, !!previewWords, undefined, true);
    const pending = await this.journal.recover();
    if (!this.data.words.length) throw Error("WORDS");
    const engine = await recoverLearning(
      this.data.learning,
      pending,
      this.data.words,
    );
    if (pending.length) {
      void Promise.resolve().then(() => database()).then(db => storageDeadline(
          db.put(
            "cache",
            engine.snapshot(),
            "learning-v1:" + owner,
          ),
        )).catch(() => { /* The durable answer queue remains the fallback. */ });
    }
    this.reading = await this.createReading(this.data);
    this.planner = this.plan(engine);
    await this.planner.prepareSet();
    this.planner.hasQuestions();
    if (this.wantedCatalog && this.wantedCatalog !== this.data.catalogVersion) void this.refreshCatalog();
    return this.current();
  }
  /** Fetch/prepare away from the question path; adopt only at a frozen-set boundary. */
  refreshCatalog(): Promise<void> {
    if (this.disposed || this.options.previewWords || !this.planner) return Promise.resolve();
    if (this.catalogFlight) return this.catalogFlight;
    const generation = this.catalogGeneration, planner = this.planner;
    const requested = this.wantedCatalog;
    const work = (async () => {
      const fresh = this.filter(await this.loader.fetchData());
      if (fresh.user_id !== this.data.user_id || this.disposed || generation !== this.catalogGeneration || planner !== this.planner) return;
      if (fresh.catalogVersion && (fresh.catalogVersion === this.data.catalogVersion || fresh.catalogVersion === this.stagedVersion)) return;
      const reading = await this.createReading(fresh);
      if (this.disposed || generation !== this.catalogGeneration || planner !== this.planner) { reading?.close(); return; }
      this.stagedReading?.close();
      this.stagedReading = reading;
      this.stagedVersion = fresh.catalogVersion;
      planner.stageCatalog(fresh.words, reading ? async (word, kind) => {
        if (kind === "reading") await reading.prepare(word);
      } : undefined, () => {
        this.reading?.close();
        this.reading = reading;
        this.stagedReading = undefined;
        this.stagedVersion = undefined;
        this.data = fresh;
        this.journal.setWords(fresh.words);
      });
    })().catch(() => { /* Keep the current usable catalog if background preparation fails. */ });
    this.catalogFlight = work;
    void work.finally(() => {
      if (this.catalogFlight === work) this.catalogFlight = undefined;
      if (!this.disposed && generation === this.catalogGeneration && this.wantedCatalog &&
        this.wantedCatalog !== requested && this.wantedCatalog !== this.data.catalogVersion && this.wantedCatalog !== this.stagedVersion)
        void this.refreshCatalog();
    });
    return work;
  }
  record(answer: Answer) {
    this.journal.record(answer);
    if (!this.options.previewWords && answer.result !== "timeout" && ++this.solvedSinceSave >= 5) {
      this.solvedSinceSave = 0;
      void this.save();
    }
  }
  private async save(): Promise<boolean> {
    const saved = await this.journal.saveLocal();
    if (saved) kickSync();
    return saved;
  }
  finish(): Promise<boolean> {
    this.solvedSinceSave = 0;
    return this.save();
  }
  online() {
    if (this.journal) void this.save();
  }
  async retry(): Promise<TrainingData> {
    this.catalogGeneration++;
    this.stagedReading?.close(); this.stagedReading = undefined; this.stagedVersion = undefined;
    this.solvedSinceSave = 0;
    if (this.options.previewWords) return { ...this.current(), stats: [] };
    if (!(await this.journal.saveLocal())) return { ...this.current(), stats: [] };
    kickSync();
    try {
      const fresh = this.filter(await this.loader.fetchData());
      if (fresh.user_id !== this.data.user_id) {
        this.options.onLoginRequired();
        throw Error("LOGIN");
      }
      const reading = await this.createReading(fresh);
      let planner: TrainingPlanner;
      try {
        planner = this.plan(await recoverLearning(fresh.learning, await this.journal.recover(), fresh.words), fresh, reading);
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
