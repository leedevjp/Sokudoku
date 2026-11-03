import { DefaultScheduler, Rating, type DefaultSchedulerCard } from "ts-fsrs";
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
        last_answered_at: null,
        last_answer_id: null,
        revision: 0,
        model_version: LEARNING_VERSION,
      }),
    };
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
    // Chance-corrected logistic ability model; difficulty 0..10 is separate from FSRS difficulty.
    const learner = this.learner;
    const sigmoid =
      1 / (1 + Math.exp(-(learner.ability + 0.97 - event.difficulty) / 1.4));
    const probability = 0.25 + 0.75 * sigmoid;
    const slope = (0.75 * sigmoid * (1 - sigmoid)) / 1.4;
    const information = (slope * slope) / (probability * (1 - probability));
    const precision = Math.min(100, learner.precision * 0.999 + information);
    const gradient =
      (((event.result === "correct" ? 1 : 0) - probability) * slope) /
      (probability * (1 - probability));
    learner.ability = clamp(
      learner.ability + clamp((0.35 * gradient) / precision, -0.35, 0.35),
      0,
      10,
    );
    learner.precision = precision;
    learner.review_count++;
    learner.last_answered_at = event.answered_at;
    learner.last_answer_id = event.id;
    learner.model_version = LEARNING_VERSION;
  }
}
