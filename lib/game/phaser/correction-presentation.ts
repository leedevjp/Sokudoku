import type Phaser from "phaser";
import type { Answer } from "../types";
import type { Correction } from "../correction";
import type { TrainingView } from "./board";
import type { CorrectionActions } from "./correction-input";
import { CorrectionCard } from "./correction-card";
import { burst } from "./effects";

/** Present an already-recorded answer without changing the training session. */
export function showCorrection(
  scene: Phaser.Scene,
  view: TrainingView,
  correction: Correction,
  answer: Answer | undefined,
  maxTime: number,
  actions: CorrectionActions,
  animate: boolean,
) {
  for (const choice of view.choices) {
    if (animate && choice.visible) burst(scene, choice.x, choice.y, answer?.result === "correct" ? view.c.green : view.c.red);
    choice.disableInteractive().setVisible(false);
  }
  view.keyHints?.setVisible(false);
  if (answer?.time_limit_ms != null) {
    const elapsed = answer.response_ms ?? maxTime;
    view.drawTime(Math.max(0, 1 - elapsed / maxTime));
    view.seconds?.setText((Math.max(0, maxTime - elapsed) / 1000).toFixed(1));
  } else {
    // Untimed training has no countdown; keep the infinity HUD without "0.0".
    view.seconds?.setText("");
  }
  view.promptCaption?.setText(
    answer?.result === "correct"
      ? view.t("正解！答えを確認しよう", "정답! 뜻과 읽기를 확인해요")
      : answer?.result === "timeout"
        ? view.t("時間切れ · 正解を確認しよう", "시간 초과 · 정답을 확인하세요")
        : view.t("もう一度、覚えよう", "다시 기억해봐요"),
  );
  view.status
    ?.setOrigin(0.5)
    .setX(view.w / 2)
    .setText(view.t("Space：停止 / 再開", "Space: 정지 / 재개"));
  const card = new CorrectionCard(scene, view, correction, actions, answer?.result ?? "incorrect");
  if (animate) {
    card.root.setAlpha(0);
    scene.tweens.add({
      targets: card.root,
      alpha: 1,
      duration: 140,
    });
  }
  return card;
}
