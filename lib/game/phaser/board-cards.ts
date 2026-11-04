import type { TrainingView } from "./board";
import type { Question } from "../types";

export function drawQuestionCard(view: TrainingView, question: Question) {
  const { scale: s, width: cw, left, top, extra } = view.boardLayout;
  const x = view.w / 2;
  const cardTop = top + 166 * s + extra,
    size = 250 * s,
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
  const badgeWidth = Math.max(94, 144 * s),
    badgeHeight = Math.max(39, 62 * s),
    badgeFont = Math.max(18, 31 * s),
    badgeX = left + badgeWidth / 2,
    badgeY = top + 166 * s;
  const badges = view.add.container(0, 0);
  badges.add(
    view.add
      .graphics()
      .fillStyle(view.c.press)
      .fillRoundedRect(
        badgeX - badgeWidth / 2,
        badgeY - badgeHeight / 2,
        badgeWidth,
        badgeHeight,
        badgeHeight / 2,
      ),
  );
  badges.add(
    view.add.circle(
      badgeX - badgeWidth * 0.3,
      badgeY,
      Math.max(4, 5 * s),
      view.c.blue,
    ),
  );
  badges.add(
    view.designText(
      badgeX + badgeWidth * 0.1,
      badgeY,
      question.kind === "reading"
        ? view.t("読み", "읽기")
        : question.word.difficulty === -1
          ? view.t("かな", "가나")
          : view.t("意味", "의미"),
      badgeFont,
      view.c.blue,
      true,
    ),
  );
  const review = question.mode === "review";
  const exam = question.mode === "exam";
  const modeColor = exam
    ? view.prefs.theme === "dark"
      ? 0xfcd778
      : 0x946010
    : review
      ? view.prefs.theme === "dark"
        ? 0xc4b5fd
        : 0x6d28d9
      : view.c.blue;
  const modeX = left + cw - badgeWidth / 2;
  badges.add(
    view.add
      .graphics()
      .fillStyle(modeColor, 0.1)
      .fillRoundedRect(
        modeX - badgeWidth / 2,
        badgeY - badgeHeight / 2,
        badgeWidth,
        badgeHeight,
        badgeHeight / 2,
      ),
  );
  badges.add(
    view.designText(
      modeX,
      badgeY,
      exam
        ? view.t("テスト", "시험")
        : review
          ? view.t("復習", "복습")
          : view.t("探索", "탐색"),
      badgeFont,
      modeColor,
      true,
    ),
  );
  const length = Array.from(question.word.term).length;
  const word = view.designText(
    0,
    14 * s,
    question.word.term,
    Math.min(150, 210 / Math.min(Math.max(length, 1), 5)) * s,
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
      cardTop + 280 * s,
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
