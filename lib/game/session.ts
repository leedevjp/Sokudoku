import { v7 as uuidv7 } from "uuid";
import type { Answer, Question, Stat } from "./types";
import { INITIAL_HEARTS } from "./rules";

/** Per-run progress and immediate feedback for question weighting. No Phaser or browser storage. */
export class TrainingSession {
  hearts = INITIAL_HEARTS;
  correct = 0;
  answers: Answer[] = [];
  reset() {
    this.hearts = INITIAL_HEARTS;
    this.correct = 0;
    this.answers = [];
  }
  record(
    question: Question,
    index: number | null,
    rawElapsed: number,
    maxTime: number,
    stats: Stat[],
  ) {
    const elapsed = Math.round(rawElapsed);
    const timeout = index === null || rawElapsed >= maxTime;
    const selected = timeout ? null : question.options[index!];
    const result = timeout
      ? "timeout"
      : selected!.id === question.word.id
        ? "correct"
        : "incorrect";
    const a: Answer = {
      id: uuidv7(),
      word_id: question.word.id,
      question_type: question.kind,
      selected_word_id: selected?.id ?? null,
      result,
      response_ms: timeout ? maxTime : Math.min(maxTime - 1, elapsed),
      time_limit_ms: maxTime,
      answered_at: new Date().toISOString(),
    };
    this.answers.push(a);
    if (result === "correct") this.correct++;
    else this.hearts--;
    // Use session feedback immediately to bias later questions; refresh exact recent-20 stats after saving.
    const previous = stats.find((s) => s.word_id === a.word_id);
    const attempts = (previous?.attempt_count ?? 0) + 1;
    const corrects =
      (previous?.correct_count ?? 0) + (result === "correct" ? 1 : 0);
    const updatedStats = stats
      .filter((s) => s.word_id !== a.word_id)
      .concat({
        word_id: a.word_id,
        user_id: previous?.user_id ?? null,
        attempt_count: attempts,
        correct_count: corrects,
        accuracy: corrects / attempts,
        average_correct_response_ms:
          result === "correct"
            ? Math.round(
                ((previous?.average_correct_response_ms ?? 0) *
                  (previous?.correct_count ?? 0) +
                  a.response_ms) /
                  corrects,
              )
            : (previous?.average_correct_response_ms ?? null),
        last_answered_at: a.answered_at,
      });

    return { answer: a, stats: updatedStats };
  }
}
