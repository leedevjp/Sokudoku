import { DefaultScheduler, Rating, type DefaultSchedulerCard } from "ts-fsrs";
import { updateLearner } from "./ability";
import {
  cardKey,
  emptyLearning,
  LEARNING_VERSION,
  type Learner,
  type LearningEvent,
  type LearningSnapshot,
  type LearningWord,
  type StoredCard,
} from "./types";

let sharedScheduler: Promise<DefaultScheduler<"FSRS-7">> | undefined;
function scheduler() {
  return (sharedScheduler ??= DefaultScheduler({
    version: "FSRS-7",
    desiredRetention: 0.9,
    enableShortTerm: true,
    learningSteps: [],
    relearningSteps: [],
    enableFuzz: false,
  }));
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Same deterministic reducer in browser and server. No network or storage calls. */
export class LearningEngine {
  readonly words = new Map<string, LearningWord>();
  readonly dirty = new Map<string, LearningWord>();
  learner: Learner;
  private constructor(
    private fsrs: DefaultScheduler<"FSRS-7">,
    snapshot: LearningSnapshot,
  ) {
    this.learner = {
      ...(snapshot.learner ?? {
        ability: 5,
        precision: 0.4,
        review_count: 0,
        ability_count: 0,
        last_answered_at: null,
        last_answer_id: null,
        revision: 0,
        model_version: LEARNING_VERSION,
      }),
    };
    this.learner.ability_count ??= this.learner.review_count;
    for (const word of snapshot.words)
      this.words.set(
        cardKey(word.source, word.word_ref, word.question_type),
        structuredClone(word),
      );
  }
  static async create(snapshot: LearningSnapshot = emptyLearning()) {
    return new LearningEngine(await scheduler(), snapshot);
  }
  snapshot(): LearningSnapshot {
    return { learner: { ...this.learner }, words: [...this.words.values()] };
  }
  private hydrate(word: LearningWord): DefaultSchedulerCard<"FSRS-7"> {
    return {
      ...word.card,
      dueAt: new Date(word.card.dueAt),
      lastReviewAt: word.card.lastReviewAt
        ? new Date(word.card.lastReviewAt)
        : null,
    };
  }
  retrievability(word: LearningWord, now = Date.now()) {
    const elapsed = Math.max(
      0,
      (now - Date.parse(word.last_review_at)) / 86_400_000,
    );
    return clamp(
      this.fsrs.model.forgettingCurve(this.hydrate(word), elapsed),
      0,
      1,
    );
  }
  apply(event: LearningEvent) {
    const key = cardKey(event.source, event.word_id, event.question_type);
    const previous = this.words.get(key);
    if (previous?.last_answer_id === event.id) return;
    const now = new Date(event.answered_at);
    const card = previous
      ? this.hydrate(previous)
      : this.fsrs.newCard({ cardId: key, now });
    const { card: next } = this.fsrs.review({
      card,
      grade: event.result === "correct" ? Rating.Good : Rating.Again,
      now,
    });
    const stored = JSON.parse(JSON.stringify(next)) as StoredCard;
    const word: LearningWord = {
      word_id: event.source === "word" ? event.word_id : null,
      personal_word_id: event.source === "personal" ? event.word_id : null,
      source: event.source,
      word_ref: event.word_id,
      question_type: event.question_type,
      card: stored,
      due_at: stored.dueAt,
      last_review_at: event.answered_at,
      last_result: event.result,
      last_answer_id: event.id,
      model_version: LEARNING_VERSION,
    };
    this.words.set(key, word);
    this.dirty.set(key, word);
    updateLearner(this.learner, event);
  }
}
