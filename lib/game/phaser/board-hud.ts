import type { TrainingView } from "./board";
export type TimeBar = { x: number; y: number; width: number; height: number };
export function drawHud(
  view: TrainingView,
  correct: number,
  maxTime: number,
  pauseAction: () => void,
  toggleSound: () => void,
  soundEnabled: () => boolean,
  timeLimited = true,
) {
  const { scale: s, left, width: cw, top } = view.boardLayout;
  const x = view.w / 2,
    right = left + cw;
  const headerY = top + 22 * s;
  const mark = view.add.container(left + 22 * s, headerY);
  const logo = view.box(0, 0, 44 * s, 44 * s, view.c.blue, 14 * s);
  mark.add(logo);
  mark.add(view.designText(0, 0, "速", 23 * s, view.c.onBrand, true));
  view
    .designText(left + 56 * s, headerY, "Sokudoku", 19 * s, view.c.ink, true)
    .setOrigin(0, 0.5);
  view.designText(left + 151 * s, headerY, ".", 22 * s, view.c.blue, true);
  view.heartView = view.add.container(x, headerY);
  const pause = view.add.container(right - 22 * s, headerY);
  pause.add(view.box(0, 0, 44 * s, 44 * s, view.c.panel, 14 * s));
  pause.add(
    view.add
      .graphics()
      .fillStyle(view.c.ink)
      .fillRoundedRect(-7 * s, -8 * s, 5 * s, 16 * s, 2 * s)
      .fillRoundedRect(3 * s, -8 * s, 5 * s, 16 * s, 2 * s),
  );
  pause
    .setSize(Math.max(44, 44 * s), Math.max(44, 44 * s))
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => pauseAction());
  const sound = view.add.container(right - 22 * s - Math.max(50, 58 * s), headerY);
  sound.add(view.box(0, 0, 44 * s, 44 * s, view.c.panel, 14 * s));
  // Draw a real diagonal mute stroke instead of a font-dependent combining glyph.
  sound.add(view.designText(0, 0, "♪", 25 * s, view.c.ink, true));
  const muteStroke = view.add.graphics().lineStyle(3.5 * s, view.c.ink, 1);
  muteStroke.lineBetween(-12 * s, 13 * s, 12 * s, -13 * s);
  muteStroke.setVisible(!soundEnabled());
  sound.add(muteStroke);
  sound.setSize(Math.max(44, 44 * s), Math.max(44, 44 * s))
    .setInteractive({ useHandCursor: true }).on("pointerup", () => {
      toggleSound();
      muteStroke.setVisible(!soundEnabled());
    });
  const metaY = top + 89 * s;
  view
    .designText(
      left,
      metaY + 5 * s,
      view.t("正答", "정답"),
      15 * s,
      view.c.muted,
    )
    .setOrigin(0, 0.5);
  view.scoreView = view
    .designText(left + 37 * s, metaY, String(correct), 34 * s, view.c.ink, true)
    .setOrigin(0, 0.5);
  view.seconds = view
    .designText(
      right - 82 * s,
      metaY,
      timeLimited ? (maxTime / 1000).toFixed(1) : "∞",
      34 * s,
      view.c.blue,
      true,
    )
    .setOrigin(1, 0.5);
  view.maxSeconds = view
    .designText(
      right,
      metaY + 5 * s,
      timeLimited ? "s / " + (maxTime / 1000).toFixed(1) + "s" : "",
      16 * s,
      view.c.muted,
    )
    .setOrigin(1, 0.5);
  const timeBar = { x: left, y: top + 114 * s, width: cw, height: 14 * s };
  view.add
    .graphics()
    .fillStyle(view.c.press)
    .fillRoundedRect(left, timeBar.y, cw, 14 * s, 7 * s);
  view.bar = view.add.graphics();

  return timeBar;
}
export function drawInputHint(view: TrainingView) {
  const { scale: s, top, extra } = view.boardLayout;
  const x = view.w / 2;
  const footerY = top + 980 * s + extra;
  view.keyHints = view.add.container(x - 135 * s, footerY);
  for (let i = 0; i < 4; i++) {
    view.keyHints.add(
      view.box(i * 34 * s, 0, 28 * s, 26 * s, view.c.panel, 7 * s),
    );
    view.keyHints.add(
      view.designText(i * 34 * s, 0, String(i + 1), 14 * s, view.c.ink, true),
    );
  }
  view.status = view
    .designText(
      x + 5 * s,
      footerY,
      view.t("タップですぐに回答。", "누르는 순간, 바로 답하세요."),
      17 * s,
      view.c.muted,
    )
    .setOrigin(0, 0.5);
}
