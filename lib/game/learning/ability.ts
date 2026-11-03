import { LEARNING_VERSION, type Learner, type LearningEvent } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Update the app's ability estimate in place, independently of FSRS memory. */
export function updateLearner(learner: Learner, event: LearningEvent): void {
  // Chance-corrected logistic ability model; difficulty 0..10 is separate from FSRS difficulty.
  learner.review_count++;
  learner.last_answered_at = event.answered_at;
  learner.last_answer_id = event.id;
  learner.model_version = LEARNING_VERSION;
  if (event.difficulty < 0) return;
  learner.ability_count++;
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
}
