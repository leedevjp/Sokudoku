import type { Answer } from "../types";
import type { TrainingView } from "./board";

export function paintAnswerFeedback(
  view: TrainingView,
  answer: Answer,
  hearts: number,
  correct: number,
) {
  view.updateHearts(hearts);
  view.scoreView?.setText(String(correct));
  view.keyHints?.setVisible(false);
  view.status?.setOrigin(0.5).setPosition(view.w / 2, view.status.y);
  view.status?.setText(
    answer.result === "correct"
      ? `${view.t("正解", "정답")} · ${answer.response_ms} ms`
      : answer.result === "timeout"
        ? view.t("時間切れ", "시간 초과")
        : view.t("もう一度、覚えよう", "다시 기억해봐요"),
  );
}
