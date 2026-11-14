import type Phaser from "phaser";
import type { TrainingView } from "./board";
import { RabbitCompanion } from "./rabbit-companion";
import { drawEnd, type ResultData, type ResultActions } from "./result-overlay";

/** Result artwork only; saving, retry and run transitions stay in TrainingScene. */
export function drawTrainingResult(
  scene: Phaser.Scene,
  view: TrainingView,
  correct: number,
  data: ResultData,
  actions: ResultActions,
): RabbitCompanion {
  scene.game.canvas.setAttribute(
    "aria-label",
    [
      view.t("結果", "결과"),
      view.t("正答", "정답") + " " + correct,
      view.t("回答", "답변") + " " + data.answers.length,
    ].join(" / "),
  );
  const resultLayout = drawEnd(view, data, actions);
  const s = Math.min(1, (view.h - 32) / 680);
  if (data.syncing && !data.preview) {
    // Indeterminate spinner: saving has no measurable percentage.
    // The busy indicator belongs after the saving label, never on its left.
    const spinner = scene.add.container(
      Math.min(view.w - 20 * s, resultLayout.statusRight + 18 * s),
      resultLayout.statusY,
    );
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      spinner.add(
        scene.add.circle(
          Math.cos(angle) * 11 * s,
          Math.sin(angle) * 11 * s,
          2.8 * s,
          view.c.blue,
          0.25 + (i / 7) * 0.75,
        ),
      );
    }
    scene.tweens.add({
      targets: spinner,
      angle: 360,
      duration: 900,
      repeat: -1,
      ease: "Linear",
    });
  }
  const width = Math.min(view.w - 32, 500);
  return new RabbitCompanion(
    scene,
    view.w / 2 + width / 2 - 65 * s,
    view.h / 2 - 225 * s,
    100 * s,
  );
}
