import Phaser from "phaser";
import type { TrainingView } from "./board";
import type { Question } from "../types";
import { choiceLabel } from "../rules";

export function paintChoice(
  view: TrainingView,
  g: Phaser.GameObjects.Graphics,
  c: Phaser.GameObjects.Container,
  pressed = false,
  correct = false,
) {
  const { scale: s } = view.boardLayout;
  const w = c.width,
    h = c.height,
    r = 22 * s;
  g.clear()
    .fillStyle(pressed ? view.c.blueDark : view.c.shade)
    .fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 6) * s, w, h, r);
  g.fillStyle(
    correct ? view.c.green : pressed ? view.c.press : view.c.panel,
  ).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.lineStyle(
    Math.max(1, 2 * s),
    correct ? view.c.green : pressed ? view.c.blue : view.c.line,
  ).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
}

export function drawChoices(
  view: TrainingView,
  question: Question,
  press: (source: string, index: number) => void,
) {
  const { scale: s, left, width: cw, top, extra } = view.boardLayout;
  const choices: Phaser.GameObjects.Container[] = [];
  const backgrounds = new Map<
    Phaser.GameObjects.Container,
    Phaser.GameObjects.Graphics
  >();
  const labels = new Map<
    Phaser.GameObjects.Container,
    Phaser.GameObjects.Text
  >();
  const choiceTop = top + 644 * s + extra,
    gap = 16 * s,
    ch = 128 * s,
    width = (cw - gap) / 2;
  question.options.forEach((option, i) => {
    const bx = left + width / 2 + (i % 2) * (width + gap),
      by = choiceTop + ch / 2 + Math.floor(i / 2) * (ch + gap);
    const container = view.add.container(bx, by);
    container.setSize(width, ch);
    const background = view.add.graphics();
    container.add(background);
    backgrounds.set(container, background);
    paintChoice(view, background, container);
    const badgeCenter = -width / 2 + 41 * s;
    container.add(
      view.add
        .graphics()
        .fillStyle(view.c.press)
        .fillRoundedRect(badgeCenter - 19 * s, -19 * s, 38 * s, 38 * s, 12 * s),
    );
    container.add(
      view.designText(badgeCenter, 0, String(i + 1), 19 * s, view.c.blue, true),
    );
    const label = view
      .designText(
        -width / 2 + 76 * s,
        0,
        choiceLabel(option, question.kind),
        24 * s,
        view.c.ink,
        true,
      )
      .setOrigin(0, 0.5);
    label.setWordWrapWidth(width - 96 * s, true);
    while (
      label.height > ch - 28 * s &&
      parseFloat(String(label.style.fontSize)) > 15 * s
    )
      label.setFontSize(parseFloat(String(label.style.fontSize)) - 1);
    container.add(label);
    labels.set(container, label);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || p.leftButtonDown()) press("p" + p.id, i);
    });
    choices.push(container);
  });

  return { choices, backgrounds, labels };
}
