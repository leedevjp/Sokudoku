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

export function drawQuestionCard(view: TrainingView, question: Question) {
  const { scale: s, width: cw, top, extra } = view.boardLayout;
  const x = view.w / 2;
  const cardTop = top + 202 * s + extra,
    size = 300 * s,
    qy = cardTop + size / 2;
  view.wordView = view.add.container(x, qy);
  const halo = view.add.graphics();
  for (let i = 12; i >= 1; i--)
    halo
      .fillStyle(view.c.blue, view.prefs.theme === "dark" ? 0.004 : 0.007)
      .fillRoundedRect(
        -size / 2 - i * 2 * s,
        -size / 2 + i * s,
        size + i * 4 * s,
        size + 25 * s,
        40 * s,
      );
  view.wordView.add(halo);
  const frame = view.add
    .graphics()
    .lineStyle(Math.max(1.5, 4 * s), view.c.blue);
  const edge = size / 2 + 22 * s,
    arm = 46 * s;
  for (const dx of [-1, 1])
    for (const dy of [-1, 1])
      frame
        .beginPath()
        .moveTo(dx * (edge - arm), dy * edge)
        .lineTo(dx * edge, dy * edge)
        .lineTo(dx * edge, dy * (edge - arm))
        .strokePath();
  view.wordView.add(frame);
  view.wordView.add(view.box(0, 0, size, size, view.c.panel, 40 * s));
  const tint = view.add.graphics();
  tint
    .fillGradientStyle(
      view.c.panel,
      view.c.panel,
      view.c.tint,
      view.c.tint,
      1,
      1,
      1,
      1,
    )
    .fillRoundedRect(
      -size / 2 + 2 * s,
      -size / 2 + 2 * s,
      size - 4 * s,
      size - 10 * s,
      38 * s,
    );
  view.wordView.add(tint);
  const badgeWidth = 72 * s,
    badgeX = -size / 2 + 22 * s + badgeWidth / 2,
    badgeY = -size / 2 + 36 * s;
  view.wordView.add(
    view.add
      .graphics()
      .fillStyle(view.c.press)
      .fillRoundedRect(
        badgeX - badgeWidth / 2,
        badgeY - 15 * s,
        badgeWidth,
        30 * s,
        15 * s,
      ),
  );
  view.wordView.add(
    view.add.circle(badgeX - 20 * s, badgeY, 4 * s, view.c.blue),
  );
  view.wordView.add(
    view.designText(
      badgeX + 7 * s,
      badgeY,
      question.kind === "reading"
        ? view.t("読み", "읽기")
        : question.word.difficulty === -1
          ? view.t("かな", "가나")
          : view.t("意味", "의미"),
      14 * s,
      view.c.blue,
      true,
    ),
  );
  const review = question.mode === "review";
  const modeColor = review
    ? view.prefs.theme === "dark"
      ? 0xc4b5fd
      : 0x6d28d9
    : view.c.blue;
  const modeX = size / 2 - 22 * s - badgeWidth / 2;
  view.wordView.add(
    view.add.graphics().fillStyle(modeColor, 0.1).fillRoundedRect(
      modeX - badgeWidth / 2,
      badgeY - 15 * s,
      badgeWidth,
      30 * s,
      15 * s,
    ),
  );
  view.wordView.add(
    view.designText(
      modeX,
      badgeY,
      review ? view.t("復習", "복습") : view.t("探索", "탐색"),
      14 * s,
      modeColor,
      true,
    ),
  );
  const length = Array.from(question.word.term).length;
  const word = view.designText(
    0,
    14 * s,
    question.word.term,
    Math.min(176, 245 / Math.min(Math.max(length, 1), 5)) * s,
    view.c.ink,
  );
  word.setWordWrapWidth(size - 38 * s, true);
  while (
    word.height > size - 90 * s &&
    parseFloat(String(word.style.fontSize)) > 20 * s
  )
    word.setFontSize(parseFloat(String(word.style.fontSize)) - 1);
  view.wordView.add(word);
  view.spark(x - size / 2 - 55 * s, cardTop + 12 * s, 15 * s, 0.7);
  view.spark(x + size / 2 + 65 * s, cardTop + size + 44 * s, 10 * s, 0.45);
  view.promptCaption = view
    .designText(
      x,
      cardTop + 359 * s,
      question.kind === "reading"
        ? view.t("読み方を選んでください", "읽기를 고르세요")
        : question.word.difficulty === -1
          ? view.t("発音を選んでください", "발음 표기를 고르세요")
          : view.t("韓国語の意味を選んでください", "한국어 뜻을 고르세요"),
      20 * s,
      view.c.muted,
    )
    .setWordWrapWidth(cw, true);
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
