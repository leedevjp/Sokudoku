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
  expectedOwner?: string;
  onLoginRequired: () => void;
  onAnswersSaved?: () => void;
};

/** Ignore server-only revision bookkeeping; compare every field that can affect scheduling. */
function sameLearningState(current: LearningEngine, incoming: LearningEngine): boolean {
  const a = current.learner, b = incoming.learner;
  if (a.ability !== b.ability || a.precision !== b.precision ||
      a.review_count !== b.review_count || a.ability_count !== b.ability_count ||
      a.last_answered_at !== b.last_answered_at || a.last_answer_id !== b.last_answer_id ||
      a.model_version !== b.model_version || current.words.size !== incoming.words.size)
    return false;
  for (const [key, word] of current.words) {
    const next = incoming.words.get(key);
    if (!next || word.last_answer_id !== next.last_answer_id ||
        word.last_review_at !== next.last_review_at || word.due_at !== next.due_at ||
        word.last_result !== next.last_result || word.model_version !== next.model_version)
      return false;
    const card = next.card as Record<string, unknown>;
    const fields = Object.entries(word.card);
    if (fields.length !== Object.keys(card).length ||
        fields.some(([name, value]) => !Object.prototype.hasOwnProperty.call(card, name) || card[name] !== value))
      return false;
  }
  return true;
}

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
  private stagedSyncVersion?: number;
  private wantedSyncVersion?: number;
  private playedAnswers: Answer[] = [];
  private stagedReading?: ReadingSearch;
  private synced = (event: Event) => {
    if (this.disposed || this.options.previewWords) return;
    this.options.onAnswersSaved?.();
    const detail = (event as CustomEvent<{ catalogVersion?: string; syncVersion?: number }>).detail;
    const version = detail?.catalogVersion;
    const syncVersion = detail?.syncVersion;
    if (version) this.wantedCatalog = version;
    if (syncVersion) this.wantedSyncVersion = syncVersion;
    if ((version && version !== this.data?.catalogVersion && version !== this.stagedVersion) ||
        (syncVersion && syncVersion !== this.data?.syncVersion && syncVersion !== this.stagedSyncVersion))
      void this.refreshCatalog();
  };

  constructor(private options: RuntimeOptions) {
    this.loader = new GameDataLoader(options.levels, () => this.options.onLoginRequired(), options.kinds.includes("meaning"), options.kinds.includes("reading"));
    if (typeof window !== "undefined") window.addEventListener("sokudoku-sync-updated", this.synced);
  }
  setHandlers(onLoginRequired: () => void, onAnswersSaved?: () => void) {
    this.options.onLoginRequired = onLoginRequired;
    this.options.onAnswersSaved = onAnswersSaved;
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
    if (this.disposed) throw Error("TRAINING_CLOSED");
    if (this.options.expectedOwner && data.user_id !== this.options.expectedOwner)
      throw Error("OWNER_CHANGED");
    this.data = this.filter(data);
    const owner = this.data.user_id;
    this.journal = new AnswerJournal(owner, this.data.words, !!previewWords, undefined, true);
    // The worker captures the learning snapshot and its pending outbox in
    // one IndexedDB transaction. Do not re-read the queue after an ACK commit.
    const pending = this.data.pendingAnswers ?? await this.journal.recover();
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
    if ((this.wantedCatalog && this.wantedCatalog !== this.data.catalogVersion) ||
        (this.wantedSyncVersion && this.wantedSyncVersion !== this.data.syncVersion))
      void this.refreshCatalog();
    return this.current();
  }
  /** Refresh canonical learning and catalog away from the question path; switch at the next question. */
  refreshCatalog(): Promise<void> {
    if (this.disposed || this.options.previewWords || !this.planner) return Promise.resolve();
    if (this.catalogFlight) return this.catalogFlight;
    const generation = this.catalogGeneration, planner = this.planner;
    const requested = this.wantedCatalog, requestedSync = this.wantedSyncVersion;
    const work = (async () => {
      const fresh = this.filter(await this.loader.fetchData());
      if (fresh.user_id !== this.data.user_id || this.disposed || generation !== this.catalogGeneration || planner !== this.planner) return;
      if (fresh.syncVersion !== undefined
        ? fresh.syncVersion === this.data.syncVersion || fresh.syncVersion === this.stagedSyncVersion
        : fresh.catalogVersion !== undefined &&
          (fresh.catalogVersion === this.data.catalogVersion || fresh.catalogVersion === this.stagedVersion)) return;
      const catalogChanged = fresh.catalogVersion !== this.data.catalogVersion;
      // A learning-only sync does not invalidate the vocabulary or reading
      // indexes. Reusing them avoids rebuilding choices for no catalog change.
      const words = catalogChanged ? fresh.words : this.data.words;
      const reading = catalogChanged ? await this.createReading(fresh) : this.reading;
      // Replay pending answers plus this run's answers (even if already ACKed),
      // so a late sync cannot wipe out locally played questions.
      const pending = fresh.pendingAnswers ?? await this.journal.recover();
      const engine = await recoverLearning(
        fresh.learning ?? planner.engine.snapshot(),
        [...pending, ...this.playedAnswers],
        words,
      );
      if (this.disposed || generation !== this.catalogGeneration || planner !== this.planner) {
        if (catalogChanged) reading?.close();
        return;
      }
      // An ACK of this run's answers changes the server revision, not our
      // already-updated FSRS cards. Keep the undisplayed questions intact.
      // Do not bypass an earlier staged refresh (which may contain remote edits).
      if (!catalogChanged && this.stagedVersion === undefined &&
          this.stagedSyncVersion === undefined && sameLearningState(planner.engine, engine)) {
        this.data = { ...this.data, syncVersion: fresh.syncVersion };
        return;
      }
      this.stagedReading?.close();
      this.stagedReading = catalogChanged ? reading : undefined;
      this.stagedVersion = fresh.catalogVersion;
      this.stagedSyncVersion = fresh.syncVersion;
      planner.stageCatalog(words, reading ? async (word, kind) => {
        if (kind === "reading") await reading.prepare(word);
      } : undefined, () => {
        if (catalogChanged) {
          this.reading?.close();
          this.reading = reading;
          this.stagedReading = undefined;
        }
        this.stagedVersion = undefined;
        this.stagedSyncVersion = undefined;
        this.data = { ...fresh, words, readingWords: catalogChanged ? fresh.readingWords : this.data.readingWords };
        this.journal.setWords(words);
      }, engine);
    })().catch(() => { /* Keep the current usable catalog if background preparation fails. */ });
    this.catalogFlight = work;
    void work.finally(() => {
      if (this.catalogFlight === work) this.catalogFlight = undefined;
      if (!this.disposed && generation === this.catalogGeneration &&
        ((this.wantedCatalog && this.wantedCatalog !== requested &&
          this.wantedCatalog !== this.data.catalogVersion && this.wantedCatalog !== this.stagedVersion) ||
         (this.wantedSyncVersion && this.wantedSyncVersion !== requestedSync &&
          this.wantedSyncVersion !== this.data.syncVersion && this.wantedSyncVersion !== this.stagedSyncVersion)))
        void this.refreshCatalog();
    });
    return work;
  }
  record(answer: Answer) {
    // Prefer the source captured from the visible card. The catalog may
    // already have switched while that old card was still on screen.
    const source = answer.source ?? (this.data.words.find(item => item.id === answer.word_id)?.source === "personal"
      ? "personal" : "word");
    const recorded = { ...answer, source };
    this.playedAnswers.push(recorded);
    this.journal.record(recorded);
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
    this.planner?.discardStagedCatalog();
    this.stagedReading?.close(); this.stagedReading = undefined; this.stagedVersion = undefined; this.stagedSyncVersion = undefined;
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
        planner = this.plan(await recoverLearning(fresh.learning, fresh.pendingAnswers ?? await this.journal.recover(), fresh.words), fresh, reading);
        await planner.prepareSet();
      } catch (error) { reading?.close(); throw error; }
      this.reading?.close();
      this.reading = reading;
      this.data = fresh;
      this.journal.setWords(fresh.words);
      this.planner = planner;
      this.playedAnswers = [];
      return this.current();
    } catch {
      return { ...this.current(), stats: [] };
    }
  }
}
