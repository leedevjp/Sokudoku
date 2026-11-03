import Phaser from "phaser";
import { choiceLabel, INITIAL_HEARTS, limitFor } from "../rules";
import type { Question } from "../types";
import { palette, translate, type Preferences } from "../preferences";

type BoardActions = {
  pause: () => void;
  press: (source: string, index: number) => void;
};

/** Owns display objects; game rules and lifecycle remain in TrainingScene. */
export class TrainingView {
  choices: Phaser.GameObjects.Container[] = [];
  wordView?: Phaser.GameObjects.Container;
  bar?: Phaser.GameObjects.Graphics;
  seconds?: Phaser.GameObjects.Text;
  status?: Phaser.GameObjects.Text;
  heartView?: Phaser.GameObjects.Container;
  maxSeconds?: Phaser.GameObjects.Text;
  promptCaption?: Phaser.GameObjects.Text;
  keyHints?: Phaser.GameObjects.Container;
  scoreView?: Phaser.GameObjects.Text;
  private choiceBackgrounds = new Map<
    Phaser.GameObjects.Container,
    Phaser.GameObjects.Graphics
  >();
  private choiceLabels = new Map<
    Phaser.GameObjects.Container,
    Phaser.GameObjects.Text
  >();
  private timeBar = { x: 0, y: 0, width: 0, height: 0 };
  private question!: Question;
  private hearts = INITIAL_HEARTS;
  private correct = 0;
  private maxTime = limitFor(0);
  constructor(
    private scene: Phaser.Scene,
    private getDensity: () => number,
    private getPreferences: () => Preferences,
    private actions: BoardActions,
  ) {}
  get add() {
    return this.scene.add;
  }
  private get game() {
    return this.scene.game;
  }
  private get density() {
    return this.getDensity();
  }
  private get prefs() {
    return this.getPreferences();
  }
  get c() {
    return palette[this.prefs.theme];
  }
  get w() {
    return this.scene.scale.width / this.density;
  }
  get h() {
    return this.scene.scale.height / this.density;
  }
  get cw() {
    return this.boardLayout.width;
  }
  get boardLayout() {
    const scale = Math.max(
      0.25,
      Math.min((this.w - 48) / 632, (this.h - 26) / 1024, 1),
    );
    const width = 632 * scale;
    const top = Math.max(14, Math.min(38 * scale, (this.h - 1024 * scale) / 2));
    const extra = Math.max(0, this.h - (top + 1024 * scale)) * 0.45;
    return { scale, width, left: (this.w - width) / 2, top, extra };
  }
  get factor() {
    return Math.min(1.15, this.cw / 440);
  }
  t(jp: string, kr: string) {
    return translate(this.prefs.lang, jp, kr);
  }
  hex(n: number) {
    return "#" + n.toString(16).padStart(6, "0");
  }
  clear() {
    this.choices = [];
    this.choiceBackgrounds.clear();
    this.choiceLabels.clear();
    this.bar = undefined;
    this.seconds = undefined;
    this.status = undefined;
    this.wordView = undefined;
    this.heartView = undefined;
    this.maxSeconds = undefined;
    this.promptCaption = undefined;
    this.keyHints = undefined;
    this.scoreView = undefined;
  }
  updateHearts(hearts: number) {
    this.hearts = hearts;
    this.drawHearts();
  }
  highlightCorrect(index: number) {
    const choice = this.choices[index];
    if (!choice) return;
    this.paintChoice(choice, false, true);
    this.choiceLabels.get(choice)?.setColor("#06152f");
  }
  text(x: number, y: number, value: string, size: number, color = this.c.ink) {
    return this.add
      .text(x, y, value, {
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: Math.round(size * this.factor),
        color: this.hex(color),
        align: "center",
        lineSpacing: 6,
      })
      .setResolution(Math.min(4, Math.max(2, this.density * 1.5)))
      .setOrigin(0.5);
  }
  box(
    x: number,
    y: number,
    width: number,
    height: number,
    color = this.c.panel,
    r = 20,
  ) {
    const g = this.add.graphics();
    const depth = Math.max(3, 6 * this.boardLayout.scale);
    g.fillStyle(this.c.shade).fillRoundedRect(
      x - width / 2,
      y - height / 2 + depth,
      width,
      height,
      r,
    );
    g.fillStyle(color).fillRoundedRect(
      x - width / 2,
      y - height / 2,
      width,
      height,
      r,
    );
    g.lineStyle(
      Math.max(1, 2 * this.boardLayout.scale),
      color === this.c.blue ? this.c.blueDark : this.c.line,
    ).strokeRoundedRect(x - width / 2, y - height / 2, width, height, r);
    return g;
  }
  designText(
    x: number,
    y: number,
    label: string,
    size: number,
    color = this.c.ink,
    bold = false,
  ) {
    const text = this.text(x, y, label, size / this.factor, color);
    if (bold) text.setFontStyle("bold");
    return text;
  }
  backdrop() {
    const g = this.add.graphics();
    const dark = this.prefs.theme === "dark";
    const radius = Math.max(this.w * 0.65, 380);
    for (let i = 28; i >= 1; i--) {
      g.fillStyle(this.c.blue, dark ? 0.007 : 0.004).fillCircle(
        this.w * 0.9,
        this.h * 0.03,
        (radius * i) / 28,
      );
      g.fillStyle(this.c.sky, dark ? 0.004 : 0.005).fillCircle(
        this.w * 0.04,
        this.h * 0.97,
        (radius * i) / 28,
      );
    }
    const step = Math.max(18, 32 * this.boardLayout.scale);
    g.fillStyle(this.c.dot, dark ? 0.12 : 0.1);
    for (let x = step / 2; x < this.w; x += step)
      for (let y = step / 2; y < this.h; y += step)
        g.fillCircle(x, y, Math.max(0.8, 1.5 * this.boardLayout.scale));
  }
  paintChoice(
    c: Phaser.GameObjects.Container,
    pressed = false,
    correct = false,
  ) {
    const g = this.choiceBackgrounds.get(c)!;
    const { scale: s } = this.boardLayout;
    const w = c.width,
      h = c.height,
      r = 22 * s;
    g.clear()
      .fillStyle(pressed ? this.c.blueDark : this.c.shade)
      .fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 6) * s, w, h, r);
    g.fillStyle(
      correct ? this.c.green : pressed ? this.c.press : this.c.panel,
    ).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(
      Math.max(1, 2 * s),
      correct ? this.c.green : pressed ? this.c.blue : this.c.line,
    ).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
  drawHearts() {
    if (!this.heartView) return;
    this.heartView.removeAll(true);
    const { scale: s } = this.boardLayout;
    for (let i = 0; i < INITIAL_HEARTS; i++) {
      const g = this.add.graphics();
      const points: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 64; k++) {
        const a = (k * Math.PI * 2) / 64;
        points.push(
          new Phaser.Math.Vector2(
            (i - 2) * 38 * s + 16 * Math.pow(Math.sin(a), 3) * 0.92 * s,
            (-13 * Math.cos(a) +
              5 * Math.cos(2 * a) +
              2 * Math.cos(3 * a) +
              Math.cos(4 * a) -
              2.5) *
              0.92 *
              s,
          ),
        );
      }
      if (i < this.hearts) g.fillStyle(this.c.red).fillPoints(points, true);
      else
        g.lineStyle(Math.max(1, 2 * s), this.c.muted, 0.45).strokePoints(
          points,
          true,
        );
      this.heartView.add(g);
    }
  }
  spark(x: number, y: number, r: number, alpha: number) {
    const g = this.add.graphics().fillStyle(this.c.blue, alpha);
    g.fillPoints(
      [
        { x, y: y - r },
        { x: x + r * 0.25, y: y - r * 0.25 },
        { x: x + r, y },
        { x: x + r * 0.25, y: y + r * 0.25 },
        { x, y: y + r },
        { x: x - r * 0.25, y: y + r * 0.25 },
        { x: x - r, y },
        { x: x - r * 0.25, y: y - r * 0.25 },
      ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
    return g;
  }
  button(
    label: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
    primary = false,
    parent?: Phaser.GameObjects.Container,
  ) {
    const b = this.add.container(x, y);
    b.add(this.box(0, 0, width, 46, primary ? this.c.blue : this.c.panel, 13));
    b.add(
      this.designText(
        0,
        0,
        label,
        Math.max(14, 16 * this.factor),
        primary ? this.c.onBrand : this.c.ink,
        true,
      ),
    );
    b.setSize(width, 46).setInteractive({ useHandCursor: true });
    b.on("pointerup", action);
    if (parent) parent.add(b);
    return b;
  }
  drawBoard(
    question: Question,
    hearts: number,
    correct: number,
    maxTime: number,
  ) {
    this.question = question;
    this.hearts = hearts;
    this.correct = correct;
    this.maxTime = maxTime;
    const { scale: s, left, width: cw, top, extra } = this.boardLayout;
    const x = this.w / 2,
      right = left + cw;
    const headerY = top + 22 * s;
    const mark = this.add.container(left + 22 * s, headerY);
    const logo = this.box(0, 0, 44 * s, 44 * s, this.c.blue, 14 * s);
    mark.add(logo);
    mark.add(this.designText(0, 0, "速", 23 * s, this.c.onBrand, true));
    this.designText(
      left + 56 * s,
      headerY,
      "Sokudoku",
      19 * s,
      this.c.ink,
      true,
    ).setOrigin(0, 0.5);
    this.designText(left + 151 * s, headerY, ".", 22 * s, this.c.blue, true);
    this.heartView = this.add.container(x, headerY);
    this.drawHearts();
    const pause = this.add.container(right - 22 * s, headerY);
    pause.add(this.box(0, 0, 44 * s, 44 * s, this.c.panel, 14 * s));
    pause.add(
      this.add
        .graphics()
        .fillStyle(this.c.ink)
        .fillRoundedRect(-7 * s, -8 * s, 5 * s, 16 * s, 2 * s)
        .fillRoundedRect(3 * s, -8 * s, 5 * s, 16 * s, 2 * s),
    );
    pause
      .setSize(Math.max(44, 44 * s), Math.max(44, 44 * s))
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.actions.pause());
    const metaY = top + 89 * s;
    this.designText(
      left,
      metaY + 5 * s,
      this.t("正答", "정답"),
      15 * s,
      this.c.muted,
    ).setOrigin(0, 0.5);
    this.scoreView = this.designText(
      left + 37 * s,
      metaY,
      String(this.correct),
      34 * s,
      this.c.ink,
      true,
    ).setOrigin(0, 0.5);
    this.seconds = this.designText(
      right - 82 * s,
      metaY,
      (this.maxTime / 1000).toFixed(1),
      34 * s,
      this.c.blue,
      true,
    ).setOrigin(1, 0.5);
    this.maxSeconds = this.designText(
      right,
      metaY + 5 * s,
      "s / " + (this.maxTime / 1000).toFixed(1) + "s",
      16 * s,
      this.c.muted,
    ).setOrigin(1, 0.5);
    this.timeBar = { x: left, y: top + 114 * s, width: cw, height: 14 * s };
    this.add
      .graphics()
      .fillStyle(this.c.press)
      .fillRoundedRect(left, this.timeBar.y, cw, 14 * s, 7 * s);
    this.bar = this.add.graphics();
    const cardTop = top + 202 * s + extra,
      size = 300 * s,
      qy = cardTop + size / 2;
    this.wordView = this.add.container(x, qy);
    const halo = this.add.graphics();
    for (let i = 12; i >= 1; i--)
      halo
        .fillStyle(this.c.blue, this.prefs.theme === "dark" ? 0.004 : 0.007)
        .fillRoundedRect(
          -size / 2 - i * 2 * s,
          -size / 2 + i * s,
          size + i * 4 * s,
          size + 25 * s,
          40 * s,
        );
    this.wordView.add(halo);
    const frame = this.add
      .graphics()
      .lineStyle(Math.max(1.5, 4 * s), this.c.blue);
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
    this.wordView.add(frame);
    this.wordView.add(this.box(0, 0, size, size, this.c.panel, 40 * s));
    const tint = this.add.graphics();
    tint
      .fillGradientStyle(
        this.c.panel,
        this.c.panel,
        this.c.tint,
        this.c.tint,
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
    this.wordView.add(tint);
    const badgeWidth = 72 * s,
      badgeX = -size / 2 + 22 * s + badgeWidth / 2,
      badgeY = -size / 2 + 36 * s;
    this.wordView.add(
      this.add
        .graphics()
        .fillStyle(this.c.press)
        .fillRoundedRect(
          badgeX - badgeWidth / 2,
          badgeY - 15 * s,
          badgeWidth,
          30 * s,
          15 * s,
        ),
    );
    this.wordView.add(
      this.add.circle(badgeX - 20 * s, badgeY, 4 * s, this.c.blue),
    );
    this.wordView.add(
      this.designText(
        badgeX + 7 * s,
        badgeY,
        this.question.kind === "reading"
          ? this.t("読み", "읽기")
          : this.question.word.difficulty === -1
            ? this.t("かな", "가나")
            : this.t("意味", "의미"),
        14 * s,
        this.c.blue,
        true,
      ),
    );
    const length = Array.from(this.question.word.term).length;
    const word = this.designText(
      0,
      14 * s,
      this.question.word.term,
      Math.min(176, 245 / Math.min(Math.max(length, 1), 5)) * s,
      this.c.ink,
    );
    word.setWordWrapWidth(size - 38 * s, true);
    while (
      word.height > size - 90 * s &&
      parseFloat(String(word.style.fontSize)) > 20 * s
    )
      word.setFontSize(parseFloat(String(word.style.fontSize)) - 1);
    this.wordView.add(word);
    this.spark(x - size / 2 - 55 * s, cardTop + 12 * s, 15 * s, 0.7);
    this.spark(x + size / 2 + 65 * s, cardTop + size + 44 * s, 10 * s, 0.45);
    this.promptCaption = this.designText(
      x,
      cardTop + 359 * s,
      (this.question.mode === "review"
        ? this.t("復習 · ", "복습 · ")
        : this.t("探索 · ", "탐색 · ")) +
        (this.question.kind === "reading"
          ? this.t("読み方を選んでください", "읽기를 고르세요")
          : this.question.word.difficulty === -1
            ? this.t("発音を選んでください", "발음 표기를 고르세요")
            : this.t("韓国語の意味を選んでください", "한국어 뜻을 고르세요")),
      20 * s,
      this.c.muted,
    ).setWordWrapWidth(cw, true);
    const choiceTop = top + 644 * s + extra,
      gap = 16 * s,
      ch = 128 * s,
      width = (cw - gap) / 2;
    this.question.options.forEach((option, i) => {
      const bx = left + width / 2 + (i % 2) * (width + gap),
        by = choiceTop + ch / 2 + Math.floor(i / 2) * (ch + gap);
      const container = this.add.container(bx, by);
      container.setSize(width, ch);
      const background = this.add.graphics();
      container.add(background);
      this.choiceBackgrounds.set(container, background);
      this.paintChoice(container);
      const badgeCenter = -width / 2 + 41 * s;
      container.add(
        this.add
          .graphics()
          .fillStyle(this.c.press)
          .fillRoundedRect(
            badgeCenter - 19 * s,
            -19 * s,
            38 * s,
            38 * s,
            12 * s,
          ),
      );
      container.add(
        this.designText(
          badgeCenter,
          0,
          String(i + 1),
          19 * s,
          this.c.blue,
          true,
        ),
      );
      const label = this.designText(
        -width / 2 + 76 * s,
        0,
        choiceLabel(option, this.question.kind),
        24 * s,
        this.c.ink,
        true,
      ).setOrigin(0, 0.5);
      label.setWordWrapWidth(width - 96 * s, true);
      while (
        label.height > ch - 28 * s &&
        parseFloat(String(label.style.fontSize)) > 15 * s
      )
        label.setFontSize(parseFloat(String(label.style.fontSize)) - 1);
      container.add(label);
      this.choiceLabels.set(container, label);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.wasTouch || p.leftButtonDown()) this.actions.press("p" + p.id, i);
      });
      this.choices.push(container);
    });
    this.game.canvas.setAttribute(
      "aria-label",
      [
        this.t("問題", "문제"),
        this.question.word.term,
        this.question.kind,
        ...this.question.options.map(
          (w, i) => String(i + 1) + ": " + choiceLabel(w, this.question.kind),
        ),
        this.t("ライフ", "하트") + this.hearts,
      ].join(" / "),
    );
    const footerY = top + 980 * s + extra;
    this.keyHints = this.add.container(x - 135 * s, footerY);
    for (let i = 0; i < 4; i++) {
      this.keyHints.add(
        this.box(i * 34 * s, 0, 28 * s, 26 * s, this.c.panel, 7 * s),
      );
      this.keyHints.add(
        this.designText(i * 34 * s, 0, String(i + 1), 14 * s, this.c.ink, true),
      );
    }
    this.status = this.designText(
      x + 5 * s,
      footerY,
      this.t("タップですぐに回答。", "누르는 순간, 바로 답하세요."),
      17 * s,
      this.c.muted,
    ).setOrigin(0, 0.5);
    this.drawTime(1);
  }
  drawTime(ratio: number) {
    const { x, y, width, height } = this.timeBar;
    const fill = width * Math.max(0, ratio);
    if (!this.bar) return;
    this.bar.clear();
    if (fill < 1) return;
    const color = ratio < 0.25 ? this.c.red : this.c.blue;
    this.bar
      .fillStyle(color, 0.08)
      .fillRoundedRect(x - 2, y - 3, fill + 4, height + 6, height / 2);
    this.bar
      .fillGradientStyle(color, this.c.sky, color, this.c.sky, 1, 1, 1, 1)
      .fillRoundedRect(x, y, fill, height, Math.min(fill / 2, height / 2));
  }
}
