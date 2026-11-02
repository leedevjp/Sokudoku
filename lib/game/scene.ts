import Phaser from "phaser";
import {
  AnswerGate,
  buildQuestion,
  choiceLabel,
  keyIndex,
  limitFor,
  type Answer,
  type Question,
  type Stat,
  type Word,
} from "./core";
import { palette, type Preferences, translate } from "./preferences";
type Options = {
  words: Word[];
  stats: Stat[];
  preferences: Preferences;
  onPreferences: (p: Preferences) => void;
  onAnswer: (a: Answer) => void;
  onFinish: () => Promise<boolean>;
  onRetry: () => Promise<Stat[]>;
  onExit: () => void;
  preview?: boolean;
};
type Phase = "arming" | "play" | "flight" | "feedback" | "paused" | "end";
export class TrainingScene extends Phaser.Scene {
  private opts: Options;
  private prefs: Preferences;
  private phase: Phase = "arming";
  private beforePause: Phase = "play";
  private resizeElapsed = 0;
  private gate = new AnswerGate();
  private q!: Question;
  private hearts = 5;
  private correct = 0;
  private logs: Answer[] = [];
  private started = 0;
  private pauseAt = 0;
  private maxTime = 10000;
  private choices: Phaser.GameObjects.Container[] = [];
  private wordView?: Phaser.GameObjects.Container;
  private bar?: Phaser.GameObjects.Graphics;
  private seconds?: Phaser.GameObjects.Text;
  private status?: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;
  private held = new Set<string>();
  private syncing = false;
  private retryPending = false;
  private heartView?: Phaser.GameObjects.Container;
  private maxSeconds?: Phaser.GameObjects.Text;
  private promptCaption?: Phaser.GameObjects.Text;
  private keyHints?: Phaser.GameObjects.Container;
  private timeBar = { x: 0, y: 0, width: 0, height: 0 };
  private scoreView?: Phaser.GameObjects.Text;
  private syncOK: boolean | null = null;
  private viewGeneration = 0;
  constructor(
    opts: Options,
    private density: number,
  ) {
    super("Training");
    this.opts = opts;
    this.prefs = opts.preferences;
  }
  private get c() {
    return palette[this.prefs.theme];
  }
  private get w() {
    return this.scale.width / this.density;
  }
  private get h() {
    return this.scale.height / this.density;
  }
  private get cw() {
    return this.boardLayout.width;
  }
  private get boardLayout() {
    const scale = Math.max(
      0.25,
      Math.min((this.w - 48) / 632, (this.h - 26) / 1024, 1),
    );
    const width = 632 * scale;
    const top = Math.max(14, Math.min(38 * scale, (this.h - 1024 * scale) / 2));
    const extra = Math.max(0, this.h - (top + 1024 * scale)) * 0.45;
    return { scale, width, left: (this.w - width) / 2, top, extra };
  }
  private get factor() {
    return Math.min(1.15, this.cw / 440);
  }
  private t(jp: string, kr: string) {
    return translate(this.prefs.lang, jp, kr);
  }
  private hex(n: number) {
    return "#" + n.toString(16).padStart(6, "0");
  }
  setRenderDensity(value: number) {
    this.density = value;
  }
  private syncCamera() {
    // World units remain CSS pixels; only the framebuffer and camera are high-DPI.
    this.cameras.main
      .setViewport(0, 0, this.scale.width, this.scale.height)
      .setZoom(this.density)
      .centerOn(this.w / 2, this.h / 2);
  }
  create() {
    this.syncCamera();
    this.game.canvas.setAttribute(
      "aria-label",
      this.t(
        "単語トレーニング。数字1〜4を押した瞬間に回答。Escapeで一時停止。",
        "단어 훈련. 숫자 1~4를 누르는 순간 답하기. Escape로 일시정지.",
      ),
    );
    this.game.canvas.setAttribute("tabindex", "0");
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.hidden);
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("pointercancel", this.cancelPress);
    this.scale.on("resize", this.resize, this);
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", this.keyDown);
      window.removeEventListener("keyup", this.keyUp);
      window.removeEventListener("blur", this.hidden);
      document.removeEventListener("visibilitychange", this.visibility);
      window.removeEventListener("pointercancel", this.cancelPress);
    });
    this.startRun();
  }
  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color = this.c.ink,
  ) {
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
  private box(
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
  private designText(
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
  private backdrop() {
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
  private paintChoice(c: Phaser.GameObjects.Container, pressed = false) {
    const g = c.list[0] as Phaser.GameObjects.Graphics;
    const { scale: s } = this.boardLayout;
    const w = c.width,
      h = c.height,
      r = 22 * s;
    g.clear()
      .fillStyle(pressed ? this.c.blueDark : this.c.shade)
      .fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 6) * s, w, h, r);
    g.fillStyle(pressed ? this.c.press : this.c.panel).fillRoundedRect(
      -w / 2,
      -h / 2,
      w,
      h,
      r,
    );
    g.lineStyle(
      Math.max(1, 2 * s),
      pressed ? this.c.blue : this.c.line,
    ).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
  private drawHearts() {
    if (!this.heartView) return;
    this.heartView.removeAll(true);
    const { scale: s } = this.boardLayout;
    for (let i = 0; i < 5; i++) {
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
  private spark(x: number, y: number, r: number, alpha: number) {
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
  private button(
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
  private clear() {
    this.viewGeneration++;
    this.children.removeAll(true);
    this.choices = [];
    this.bar = undefined;
    this.seconds = undefined;
    this.status = undefined;
    this.overlay = undefined;
    this.wordView = undefined;
    this.cameras.main.setBackgroundColor(this.c.bg);
    this.backdrop();
  }
  private settings(y: number, parent?: Phaser.GameObjects.Container) {
    this.button(
      this.prefs.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP",
      this.w / 2 - 72,
      y,
      130,
      () => {
        this.prefs = {
          ...this.prefs,
          lang: this.prefs.lang === "jp" ? "kr" : "jp",
        };
        this.opts.onPreferences(this.prefs);
        this.redrawStatic();
      },
      false,
      parent,
    );
    this.button(
      this.prefs.theme === "light"
        ? this.t("☾ ダーク", "☾ 다크")
        : this.t("☀ ライト", "☀ 라이트"),
      this.w / 2 + 72,
      y,
      130,
      () => {
        this.prefs = {
          ...this.prefs,
          theme: this.prefs.theme === "light" ? "dark" : "light",
        };
        this.opts.onPreferences(this.prefs);
        this.redrawStatic();
      },
      false,
      parent,
    );
  }
  private redrawStatic() {
    if (this.phase === "end") this.drawEnd();
    else if (this.phase === "paused") {
      this.cameras.main.setBackgroundColor(this.c.bg);
      this.drawPause();
    }
  }
  private startRun() {
    if (this.syncing) return;
    this.logs = [];
    this.hearts = 5;
    this.correct = 0;
    this.syncOK = null;
    this.next();
  }
  private next() {
    try {
      this.q = buildQuestion(this.opts.words, this.opts.stats, this.q?.word.id);
    } catch {
      this.phase = "end";
      this.drawEnd();
      return;
    }
    this.maxTime = limitFor(this.correct);
    this.phase = "arming";
    this.gate.close();
    this.drawBoard();
    const generation = this.viewGeneration;
    // The timer starts only after the new question has actually been rendered.
    this.game.events.once("postrender", () => {
      if (this.phase === "arming" && generation === this.viewGeneration) {
        this.started = performance.now();
        this.phase = "play";
        this.gate.open();
      }
    });
  }
  private drawBoard() {
    this.clear();
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
      .on("pointerup", () => this.pause());
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
        this.q.kind === "reading"
          ? this.t("読み", "읽기")
          : this.t("意味", "의미"),
        14 * s,
        this.c.blue,
        true,
      ),
    );
    const length = Array.from(this.q.word.term).length;
    const word = this.designText(
      0,
      14 * s,
      this.q.word.term,
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
      this.q.kind === "reading"
        ? this.t("読み方を選んでください", "읽기를 고르세요")
        : this.t("韓国語の意味を選んでください", "한국어 뜻을 고르세요"),
      20 * s,
      this.c.muted,
    ).setWordWrapWidth(cw, true);
    const choiceTop = top + 644 * s + extra,
      gap = 16 * s,
      ch = 128 * s,
      width = (cw - gap) / 2;
    this.q.options.forEach((option, i) => {
      const bx = left + width / 2 + (i % 2) * (width + gap),
        by = choiceTop + ch / 2 + Math.floor(i / 2) * (ch + gap);
      const container = this.add.container(bx, by);
      container.setSize(width, ch);
      container.add(this.add.graphics());
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
        choiceLabel(option, this.q.kind),
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
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.wasTouch || p.leftButtonDown()) this.press("p" + p.id, i);
      });
      this.choices.push(container);
    });
    this.game.canvas.setAttribute(
      "aria-label",
      [
        this.t("問題", "문제"),
        this.q.word.term,
        this.q.kind,
        ...this.q.options.map(
          (w, i) => String(i + 1) + ": " + choiceLabel(w, this.q.kind),
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
  private drawTime(ratio: number) {
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
  update() {
    if (this.phase !== "play") return;
    const elapsed = performance.now() - this.started;
    this.drawTime(Math.max(0, 1 - elapsed / this.maxTime));
    this.seconds?.setText(
      (Math.max(0, this.maxTime - elapsed) / 1000).toFixed(1),
    );
    if (elapsed >= this.maxTime) this.resolve(null);
  }
  private press(source: string, i: number) {
    if (this.phase !== "play" || !this.gate.claim(source, i)) return;
    const card = this.choices[i];
    card.setScale(1.04);
    this.paintChoice(card, true);
    // Commit on down; the projectile is visual feedback, not part of response time.
    this.resolve(i);
  }
  private cancelPress = () => {
    const i = this.gate.index;
    this.gate.cancel();
    if (i !== null && this.choices[i]) {
      const c = this.choices[i];
      this.tweens.killTweensOf(c);
      c.setScale(1);
      this.paintChoice(c);
    }
  };
  private keyDown = (e: KeyboardEvent) => {
    const index = keyIndex(e.code);
    if (index !== null) {
      e.preventDefault();
      if (e.repeat || this.held.has(e.code)) return;
      this.held.add(e.code);
      this.press(e.code, index);
    } else if (e.code === "Escape") {
      e.preventDefault();
      if (this.phase === "paused") this.resume();
      else this.pause();
    }
  };
  private keyUp = (e: KeyboardEvent) => {
    if (keyIndex(e.code) === null) return;
    e.preventDefault();
    this.held.delete(e.code);
  };
  private resolve(index: number | null) {
    if (this.phase !== "play") return;
    const rawElapsed = Math.max(0, performance.now() - this.started);
    const elapsed = Math.round(rawElapsed);
    const timeout = index === null || rawElapsed >= this.maxTime;
    const selected = timeout ? null : this.q.options[index!];
    const result = timeout
      ? "timeout"
      : selected!.id === this.q.word.id
        ? "correct"
        : "incorrect";
    this.gate.close();
    this.phase = timeout ? "feedback" : "flight";
    const a: Answer = {
      id: crypto.randomUUID(),
      word_id: this.q.word.id,
      question_type: this.q.kind,
      selected_word_id: selected?.id ?? null,
      result,
      response_ms: timeout ? this.maxTime : Math.min(this.maxTime - 1, elapsed),
      time_limit_ms: this.maxTime,
      answered_at: new Date().toISOString(),
    };
    this.logs.push(a);
    this.opts.onAnswer(a);
    if (result === "correct") this.correct++;
    else this.hearts--;
    // Use session feedback immediately to bias later questions; refresh exact recent-20 stats after saving.
    const previous = this.opts.stats.find((s) => s.word_id === a.word_id);
    const attempts = (previous?.attempt_count ?? 0) + 1;
    const corrects =
      (previous?.correct_count ?? 0) + (result === "correct" ? 1 : 0);
    this.opts.stats = this.opts.stats
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
    const hit = () => {
      this.phase = "feedback";
      this.drawHearts();
      this.scoreView?.setText(String(this.correct));
      this.keyHints?.setVisible(false);
      this.status?.setOrigin(0.5).setPosition(this.w / 2, this.status.y);
      const at = this.wordView!;
      if (result === "correct") {
        this.burst(at.x, at.y, this.c.blue);
        at.setVisible(false);
        this.cameras.main.flash(90, 100, 190, 255, false);
      } else {
        this.burst(at.x, at.y, this.c.red);
        if (index !== null) this.choices[index]?.setVisible(false);
        this.cameras.main.shake(110, 0.004);
      }
      const answer =
        this.q.word.kana + " · " + choiceLabel(this.q.word, "meaning");
      this.status?.setText(
        result === "correct"
          ? `${this.t("正解", "정답")} · ${a.response_ms} ms`
          : result === "timeout"
            ? this.t("時間切れ", "시간 초과")
            : this.t("もう一度、覚えよう", "다시 기억해봐요"),
      );
      if (result !== "correct")
        this.promptCaption?.setText(answer).setColor(this.hex(this.c.blue));
      this.time.delayedCall(result === "correct" ? 320 : 1000, () => {
        if (this.hearts === 0) this.finish();
        else this.next();
      });
    };
    if (timeout) {
      this.drawTime(0);
      hit();
    } else {
      const flying = this.choices[index!];
      this.tweens.killTweensOf(flying);
      flying.setDepth(10);
      this.tweens.add({
        targets: flying,
        x: this.wordView!.x,
        y: this.wordView!.y,
        scaleX: 0.72,
        scaleY: 0.72,
        duration: 50,
        ease: "Cubic.In",
        onComplete: () => {
          flying.setVisible(false);
          hit();
        },
      });
    }
  }
  private burst(x: number, y: number, color: number) {
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18;
      const piece = this.add
        .rectangle(
          x,
          y,
          Phaser.Math.Between(5, 14),
          Phaser.Math.Between(5, 13),
          color,
        )
        .setDepth(20);
      this.tweens.add({
        targets: piece,
        x: x + Math.cos(angle) * Phaser.Math.Between(45, 125),
        y: y + Math.sin(angle) * Phaser.Math.Between(35, 90),
        rotation: Phaser.Math.FloatBetween(-3, 3),
        alpha: 0,
        scale: 0,
        duration: 420,
        onComplete: () => piece.destroy(),
      });
    }
  }
  private hidden = () => {
    this.held.clear();
    this.pause();
  };
  private visibility = () => {
    if (document.hidden) this.hidden();
  };
  private pause() {
    if (this.phase === "paused" || this.phase === "end") return;
    this.beforePause = this.phase;
    this.pauseAt = performance.now();
    this.cancelPress();
    this.phase = "paused";
    this.time.paused = true;
    this.tweens.pauseAll();
    this.drawPause();
  }
  private drawPause() {
    this.overlay?.destroy();
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add
        .rectangle(this.w / 2, this.h / 2, this.w, this.h, this.c.bg, 0.96)
        .setInteractive(),
    );
    overlay.add(
      this.box(
        this.w / 2,
        this.h / 2 + 22,
        Math.min(this.cw, 440),
        340,
        this.c.panel,
        26,
      ),
    );
    overlay.add(
      this.designText(
        this.w / 2,
        this.h / 2 - 100,
        this.t("ひと休み。", "잠시 쉬어가요."),
        Math.max(25, 30 * this.factor),
        this.c.ink,
        true,
      ),
    );
    overlay.add(
      this.designText(
        this.w / 2,
        this.h / 2 - 45,
        this.t("時間は止まっています", "시간은 멈춰 있습니다"),
        15,
        this.c.muted,
      ),
    );
    this.button(
      this.t("つづける →", "계속하기 →"),
      this.w / 2,
      this.h / 2 + 20,
      260,
      () => this.resume(),
      true,
      overlay,
    );
    this.button(
      this.t("終了して保存", "종료하고 저장"),
      this.w / 2,
      this.h / 2 + 82,
      260,
      () => {
        this.time.paused = false;
        this.tweens.resumeAll();
        this.finish();
      },
      false,
      overlay,
    );
    this.overlay = overlay;
    this.settings(this.h / 2 + 150, overlay);
  }
  private resume() {
    if (this.phase !== "paused") return;
    this.started += performance.now() - this.pauseAt;
    this.overlay?.destroy();
    this.overlay = undefined;
    if (this.beforePause === "play" || this.beforePause === "arming")
      this.drawBoard();
    this.phase = this.beforePause === "arming" ? "play" : this.beforePause;
    if (this.beforePause === "arming") {
      this.started = performance.now() - this.resizeElapsed;
      this.resizeElapsed = 0;
    }
    if (this.phase === "play") this.gate.open();
    this.time.paused = false;
    this.tweens.resumeAll();
  }
  private resize() {
    this.syncCamera();
    if (this.phase === "end") this.drawEnd();
    else {
      const resolved =
        this.phase === "flight" ||
        this.phase === "feedback" ||
        (this.phase === "paused" &&
          (this.beforePause === "flight" || this.beforePause === "feedback"));
      const elapsed =
        this.phase === "paused"
          ? Math.max(0, this.pauseAt - this.started)
          : Math.max(0, performance.now() - this.started);
      this.pause();
      this.resizeElapsed = resolved ? 0 : Math.min(elapsed, this.maxTime);
      this.beforePause = "arming";
      this.time.removeAllEvents();
      this.tweens.killAll();
      if (resolved) {
        if (this.hearts === 0) {
          this.finish();
          return;
        }
        this.q = buildQuestion(
          this.opts.words,
          this.opts.stats,
          this.q.word.id,
        );
        this.maxTime = limitFor(this.correct);
      }
      this.drawBoard();
      this.drawPause();
    }
  }
  private finish() {
    this.phase = "end";
    this.gate.close();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.time.paused = false;
    this.syncing = true;
    this.drawEnd();
    void this.opts
      .onFinish()
      .then((ok) => {
        if (!this.sys.isActive()) return;
        this.syncOK = ok;
        this.syncing = false;
        this.drawEnd();
      })
      .catch(() => {
        this.syncOK = false;
        this.syncing = false;
        this.drawEnd();
      });
  }
  private drawEnd() {
    this.clear();
    const x = this.w / 2,
      y = this.h / 2;
    this.box(
      x,
      y + 20,
      Math.min(this.cw, 500),
      Math.min(this.h - 40, 560),
      this.c.panel,
      28,
    );
    const correct = this.logs.filter((a) => a.result === "correct");
    const avg = correct.length
      ? Math.round(
          correct.reduce((s, a) => s + a.response_ms, 0) / correct.length,
        )
      : null;
    this.text(
      x,
      y - 220,
      this.t("おつかれさまでした", "수고했어요"),
      14,
      this.c.blue,
    );
    this.text(x, y - 160, String(correct.length), 72);
    this.text(x, y - 104, this.t("正答", "정답"), 13, this.c.muted);
    this.text(
      x,
      y - 48,
      `${this.t("正答率", "정답률")}  ${this.logs.length ? Math.round((correct.length / this.logs.length) * 100) : 0}%    /    ${avg ?? "—"} ms`,
      17,
    );
    this.text(
      x,
      y - 8,
      `${this.t("不正解", "오답")} ${this.logs.filter((a) => a.result === "incorrect").length}    ${this.t("時間切れ", "시간 초과")} ${this.logs.filter((a) => a.result === "timeout").length}`,
      14,
      this.c.muted,
    );
    const state = this.opts.preview
      ? this.t("プレビュー · 保存しません", "미리보기 · 저장하지 않습니다")
      : this.syncing
        ? this.t("記録を同期中…", "기록 동기화 중…")
        : this.syncOK
          ? this.t("記録を保存しました ✓", "기록 저장 완료 ✓")
          : this.t(
              "保存できませんでした。この画面で再試行できます",
              "저장하지 못했습니다. 이 화면에서 재시도할 수 있어요",
            );
    this.text(x, y + 46, state, 13, this.syncOK ? this.c.green : this.c.muted);
    this.button(
      this.t("もう一度 →", "다시 하기 →"),
      x,
      y + 108,
      280,
      () => {
        if (this.syncing || this.retryPending) return;
        this.retryPending = true;
        void this.opts
          .onRetry()
          .then((stats) => {
            this.opts.stats = stats;
            this.retryPending = false;
            this.startRun();
          })
          .catch(() => {
            this.retryPending = false;
            this.startRun();
          });
      },
      true,
    );
    this.button(this.t("ホームへ", "홈으로"), x, y + 169, 280, () => {
      if (!this.syncing) this.opts.onExit();
    });
    if (!this.syncOK && !this.syncing && !this.opts.preview)
      this.button(
        this.t("同期を再試行", "동기화 재시도"),
        x,
        y + 229,
        200,
        () => this.finish(),
      );
  }
}
/** High-DPI framebuffer, bounded to keep large desktops from allocating huge surfaces. */
function densityFor(parent: HTMLElement) {
  const width = Math.max(1, parent.clientWidth),
    height = Math.max(1, parent.clientHeight);
  return Math.max(
    1,
    Math.min(
      window.devicePixelRatio || 1,
      3,
      4096 / Math.max(width, height),
      Math.sqrt(8_388_608 / (width * height)),
    ),
  );
}
export function createTraining(parent: HTMLElement, options: Options) {
  let density = densityFor(parent);
  const scene = new TrainingScene(options, density);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette[options.preferences.theme].bg,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(parent.clientWidth * density),
      height: Math.round(parent.clientHeight * density),
      zoom: 1 / density,
      autoRound: false,
    },
    render: { antialias: true, antialiasGL: true, pixelArt: false },
    input: { activePointers: 3 },
    scene: [scene],
    audio: { noAudio: true },
  });
  const resizeCanvas = () => {
    if (!game.isBooted) return;
    const nextDensity = densityFor(parent);
    const width = Math.round(parent.clientWidth * nextDensity),
      height = Math.round(parent.clientHeight * nextDensity);
    if (width < 1 || height < 1) return;
    if (
      game.scale.width === width &&
      game.scale.height === height &&
      nextDensity === density
    )
      return;
    const changed = nextDensity !== density;
    density = nextDensity;
    scene.setRenderDensity(density);
    if (changed) game.scale.setZoom(1 / density);
    game.scale.resize(width, height);
  };
  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(parent);
  window.addEventListener("resize", resizeCanvas);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    window.removeEventListener("resize", resizeCanvas);
  });
  return game;
}
