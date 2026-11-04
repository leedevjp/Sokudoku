import type { Answer, Kind, Stat, Word } from "../types";
import type { TrainingMode } from "../learning/types";
import { LearningEngine } from "../learning/engine";
import { recoverLearning } from "../learning/recovery";
import { TrainingPlanner } from "../learning/planner";
import { wordsForKinds } from "../selection";
import { AnswerJournal } from "./answer-journal";
import { GameDataLoader, type Bootstrap } from "./bootstrap";
import { database, storageDeadline } from "./database";

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

  constructor(private options: RuntimeOptions) {
    this.loader = new GameDataLoader(options.levels, options.onLoginRequired);
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
  private plan(engine: LearningEngine) {
    return new TrainingPlanner(
      engine,
      this.data.words,
      this.options.kinds,
      this.options.modes,
    );
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
    this.planner = this.plan(engine);
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
      this.data = fresh;
      this.journal.setWords(fresh.words);
      this.planner = this.plan(await LearningEngine.create(fresh.learning));
      return this.current();
    } catch {
      return { ...this.current(), stats: [] };
    }
  }
}
