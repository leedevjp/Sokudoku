import Phaser from "phaser";
import type { Correction } from "../correction";
import type { Result } from "../types";
import type { TrainingView } from "./board";

import { correctionText } from "./correction-text";
import {
  bindCorrectionInput,
  type CorrectionActions,
} from "./correction-input";

/** One fixed review surface replaces the four choices; it never records answers. */
export class CorrectionCard {
  readonly root: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private pauseIcon: Phaser.GameObjects.Graphics;
  private ringX: number;
  private ringY: number;
  private radius: number;
  private iconX: number;
  private iconY: number;
  private lastPaused?: boolean;
  private readonly resultColor: number;
  private readonly correctAnswer: boolean;
  constructor(
    scene: Phaser.Scene,
    private view: TrainingView,
    correction: Correction,
    actions: CorrectionActions,
    result: Result,
  ) {
    const { scale: s, width, top, extra } = view.boardLayout;
    this.correctAnswer = result === "correct";
    this.resultColor = this.correctAnswer ? view.c.green : view.c.red;
    const height = 272 * s,
      padding = Math.max(12, 22 * s),
      controls = Math.max(48, 86 * s);
    const x = view.w / 2,
      y = top + 644 * s + extra + height / 2;
    this.root = view.add.container(x, y).setSize(width, height).setDepth(5);
    this.root.add(view.box(0, 0, width, height, view.c.panel, 22 * s));
    // Preserve the panel background while making the outcome recognizable by its border.
    this.root.add(
      view.add.graphics()
        .lineStyle(Math.max(2.5, 4 * s), this.resultColor)
        .strokeRoundedRect(-width / 2, -height / 2, width, height, 22 * s),
    );
    const badge = Math.max(21, 32 * s),
      badgeX = -width / 2 + padding + badge / 2;
    const headerY = -height / 2 + Math.max(16, 24 * s);
    this.root.add(
      view.add
        .graphics()
        .fillStyle(this.resultColor, 0.14)
        .fillRoundedRect(
          badgeX - badge / 2,
          headerY - badge / 2,
          badge,
          badge,
          9 * s,
        ),
    );
    this.root.add(
      view.designText(
        badgeX,
        headerY,
        String(correction.content.index + 1),
        Math.max(12, 18 * s),
        this.resultColor,
        true,
      ),
    );
    this.root.add(
      view
        .designText(
          badgeX + badge / 2 + 8,
          headerY,
          this.correctAnswer
            ? view.t("✓ 正解！", "✓ 정답!")
            : result === "timeout"
              ? view.t("✕ 時間切れ · 正解", "✕ 시간 초과 · 정답")
              : view.t("✕ 不正解 · 正解", "✕ 오답 · 정답"),
          Math.max(11, 16 * s),
          this.resultColor,
          true,
        )
        .setOrigin(0, 0.5),
    );

    this.ringX = width / 2 - padding - controls / 2;
    this.ringY = -height / 2 + Math.max(22, 38 * s);
    this.radius = Math.max(13, 22 * s);
    this.ring = view.add.graphics();
    this.root.add(this.ring);
    this.root.add(
      view.designText(
        this.ringX,
        this.ringY,
        "→",
        Math.max(14, 22 * s),
        this.resultColor,
        true,
      ),
    );
    this.iconX = this.ringX;
    this.iconY = height / 2 - Math.max(24, 36 * s);
    const button = view.add
      .container(this.iconX, this.iconY)
      .setSize(44, 44)
      .setInteractive({ useHandCursor: true });
    button.add(view.box(0, 0, 40, 40, view.c.press, 12));
    this.pauseIcon = view.add.graphics();
    button.add(this.pauseIcon);
    this.root.add(button);
    const textWidth = width - padding * 2 - controls - 12;
    const contentTop = -height / 2 + Math.max(33, 52 * s);
    const contentBottom = height / 2 - Math.max(18, 28 * s);
    const { rows, primarySize, secondarySize, lineHeight, slots } =
      correctionText(view, correction, textWidth, contentBottom - contentTop);
    const maxOffset = Math.max(0, rows.length - slots);
    const textRows = Array.from(
      { length: Math.min(slots, rows.length) },
      (_, i) => {
        const row = view
          .designText(
            -width / 2 + padding,
            contentTop +
              Math.max(
                0,
                (contentBottom -
                  contentTop -
                  Math.min(slots, rows.length) * lineHeight) /
                  2,
              ) +
              i * lineHeight,
            "",
            primarySize,
            view.c.ink,
            true,
          )
          .setOrigin(0, 0);
        this.root.add(row);
        return row;
      },
    );
    const drawRows = (offset: number) =>
      textRows.forEach((text, i) => {
        const row = rows[offset + i];
        text
          .setText(row.text)
          .setFontSize(row.secondary ? secondarySize : primarySize)
          .setFontStyle(row.secondary ? "normal" : "bold")
          .setColor(view.hex(row.secondary ? view.c.muted : view.c.ink));
      });
    drawRows(0);
    this.root.add(
      view
        .designText(
          -width / 2 + padding,
          height / 2 - Math.max(9, 13 * s),
          maxOffset
            ? view.t("スクロール可 · タップで次へ", "스크롤 가능 · 누르면 다음")
            : view.t("タップ・正解番号で次へ", "터치·정답 번호로 다음"),
          Math.max(9, 13 * s),
          view.c.muted,
        )
        .setOrigin(0, 0.5),
    );

    bindCorrectionInput(scene, this.root, button, actions, {
      pauseX: this.iconX,
      pauseY: this.iconY,
      maxOffset,
      lineHeight,
      drawRows,
    });
    this.update(correction);
  }
  update(correction: Correction) {
    const { ringX: x, ringY: y, radius: r } = this;
    this.ring.clear().lineStyle(3, this.view.c.line).strokeCircle(x, y, r);
    this.ring
      .lineStyle(3, this.resultColor)
      .beginPath()
      .arc(
        x,
        y,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * Math.PI * correction.ratio,
        false,
      )
      .strokePath();
    if (this.lastPaused === correction.paused) return;
    this.lastPaused = correction.paused;
    const { index, primary, secondary } = correction.content;
    this.view.game.canvas.setAttribute(
      "aria-label",
      [
        correction.term,
        (this.correctAnswer ? this.view.t("正解", "정답") : this.view.t("不正解", "오답")) + " / " + this.view.t("正解番号", "정답 번호") + " " + (index + 1),
        primary,
        secondary,
        correction.paused
          ? this.view.t("自動送り停止中", "자동 진행 정지 중")
          : this.view.t("2秒後に次へ", "2초 후 다음"),
        this.view.t(
          "正解番号で次へ。Spaceで停止・再開。",
          "정답 번호로 다음. Space로 정지·재개.",
        ),
      ]
        .filter(Boolean)
        .join(" / "),
    );
    const icon = this.pauseIcon.clear().fillStyle(this.resultColor);
    if (correction.paused) icon.fillTriangle(-5, -8, -5, 8, 8, 0);
    else
      icon.fillRoundedRect(-7, -8, 5, 16, 1).fillRoundedRect(2, -8, 5, 16, 1);
  }
}
