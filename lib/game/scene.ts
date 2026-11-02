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
type Phase =
  | "intro"
  | "arming"
  | "play"
  | "flight"
  | "feedback"
  | "paused"
  | "end";
export class TrainingScene extends Phaser.Scene {
  private opts: Options;
  private prefs: Preferences;
  private phase: Phase = "intro";
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
  private heartView?: Phaser.GameObjects.Text;
  private scoreView?: Phaser.GameObjects.Text;
  private syncOK: boolean | null = null;
  private viewGeneration = 0;
  constructor(opts: Options) {
    super("Training");
    this.opts = opts;
    this.prefs = opts.preferences;
  }
  private get c() {
    return palette[this.prefs.theme];
  }
  private get w() {
    return this.scale.width;
  }
  private get h() {
    return this.scale.height;
  }
  private get cw() {
    return Math.min(this.w - 36, 540);
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
  create() {
    this.game.canvas.setAttribute(
      "aria-label",
      this.t(
        "単語トレーニング。数字1〜4で選び、キーを離して回答。Escapeで一時停止。",
        "단어 훈련. 숫자 1~4를 누르고 떼서 답하기. Escape로 일시정지.",
      ),
    );
    this.game.canvas.setAttribute("tabindex", "0");
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.x < 0 || p.y < 0 || p.x > this.w || p.y > this.h) {
        this.cancelPress();
        return;
      }
      this.release("p" + p.id);
    });
    this.input.on("pointerupoutside", () => this.cancelPress());
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
    this.drawIntro();
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
        fontFamily: 'Arial,"Yu Gothic","Malgun Gothic",sans-serif',
        fontSize: Math.round(size * this.factor),
        color: this.hex(color),
        align: "center",
        lineSpacing: 6,
      })
      .setResolution(Math.min(window.devicePixelRatio || 1, 2))
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
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, r);
    g.lineStyle(1, this.c.line, 1);
    g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, r);
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
    b.add(this.text(0, 0, label, 13, primary ? 0xffffff : this.c.ink));
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
  }
  private drawIntro() {
    this.clear();
    const x = this.w / 2,
      y = this.h / 2;
    this.text(x, y - 165, "速読 / SOKUDOKU", 16, this.c.blue);
    this.text(
      x,
      y - 106,
      this.t("ひらめきを、打ち抜こう。", "순간의 인식으로, 돌파하세요."),
      27,
    );
    this.text(
      x,
      y - 40,
      this.t(
        "押して、離す。答えが飛んでいく。",
        "누르고, 떼세요. 정답이 날아갑니다.",
      ),
      14,
      this.c.muted,
    );
    this.text(
      x,
      y + 3,
      this.t("5ライフ · 10秒から2秒へ加速", "하트 5개 · 10초에서 2초까지 가속"),
      13,
      this.c.muted,
    );
    this.text(
      x,
      y + 40,
      this.t("1  2 / 3  4  ·  タッチ対応", "1  2 / 3  4  ·  터치 지원"),
      13,
      this.c.muted,
    );
    this.button(
      this.t("スタート →", "시작하기 →"),
      x,
      y + 110,
      Math.min(300, this.cw),
      () => this.startRun(),
      true,
    );
    this.button(this.t("ホーム", "홈"), x, y + 172, 130, () =>
      this.opts.onExit(),
    );
    this.settings(y + 232);
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
    if (this.phase === "intro") this.drawIntro();
    else if (this.phase === "end") this.drawEnd();
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
    const x = this.w / 2,
      cw = this.cw,
      left = x - cw / 2;
    const small = this.h < 650;
    this.text(left + 28, 31, "速読", 17, this.c.blue);
    this.button("Ⅱ", left + cw - 23, 31, 45, () => this.pause());
    this.heartView = this.text(
      x,
      31,
      Array.from({ length: 5 }, (_, i) => (i < this.hearts ? "♥" : "♡")).join(
        " ",
      ),
      23,
      this.c.red,
    );
    this.box(x, 86, cw, 10, this.c.line, 5);
    this.bar = this.add.graphics();
    this.seconds = this.text(
      left + cw - 30,
      109,
      `${(this.maxTime / 1000).toFixed(1)}s`,
      12,
      this.c.muted,
    );
    this.scoreView = this.text(
      left + 54,
      109,
      `${this.t("正答", "정답")}  ${this.correct}`,
      12,
      this.c.blue,
    );
    const qy = Math.max(190, this.h * (small ? 0.33 : 0.34));
    this.wordView = this.add.container(x, qy);
    const kind =
      this.q.kind === "reading"
        ? this.t("読み", "읽기")
        : this.t("意味", "의미");
    this.wordView.add(this.text(0, -54, kind, 12, this.c.blue));
    const word = this.text(
      0,
      0,
      this.q.word.term,
      Math.min(61, 300 / Math.max(2, this.q.word.term.length)),
      this.c.ink,
    );
    if (word.width > cw - 20) word.setScale((cw - 20) / word.width);
    this.wordView.add(word);
    this.wordView.add(
      this.text(
        0,
        57,
        this.q.kind === "reading"
          ? this.t("読み方を選ぼう", "읽기를 고르세요")
          : this.t("韓国語の意味を選ぼう", "한국어 뜻을 고르세요"),
        12,
        this.c.muted,
      ),
    );
    const ch = Math.max(78, Math.min(122, (this.h - qy - 140) / 2));
    const bottom = this.h - 62;
    const row2 = bottom - ch / 2,
      row1 = row2 - ch - 14;
    const width = (cw - 14) / 2;
    this.q.options.forEach((option, i) => {
      const bx = left + width / 2 + (i % 2) * (width + 14),
        by = i < 2 ? row1 : row2;
      const container = this.add.container(bx, by);
      container.add(this.box(0, 0, width, ch, this.c.panel, 18));
      container.add(
        this.text(
          -width / 2 + 23,
          -ch / 2 + 22,
          String(i + 1),
          12,
          this.c.blue,
        ),
      );
      const label = this.text(0, 8, choiceLabel(option, this.q.kind), 19);
      label.setWordWrapWidth(width - 30, true);
      while (
        label.height > ch - 38 &&
        Number(label.style.fontSize.toString().replace("px", "")) > 12
      )
        label.setFontSize(parseInt(label.style.fontSize.toString()) - 1);
      container.add(label);
      container.setSize(width, ch).setInteractive({ useHandCursor: true });
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
    this.status = this.text(
      x,
      this.h - 25,
      this.t("押して、離して、回答。", "누르고, 떼서, 답하세요."),
      11,
      this.c.muted,
    );
    this.drawTime(1);
  }
  private drawTime(ratio: number) {
    const cw = this.cw,
      x = this.w / 2 - cw / 2;
    this.bar
      ?.clear()
      .fillStyle(ratio < 0.25 ? this.c.red : this.c.sky, 1)
      .fillRoundedRect(x, 81, Math.max(0, cw * ratio), 10, 5);
  }
  update() {
    if (this.phase !== "play") return;
    const elapsed = performance.now() - this.started;
    this.drawTime(Math.max(0, 1 - elapsed / this.maxTime));
    this.seconds?.setText(
      `${(Math.max(0, this.maxTime - elapsed) / 1000).toFixed(1)}s`,
    );
    if (elapsed >= this.maxTime) this.resolve(null);
  }
  private press(source: string, i: number) {
    if (this.phase !== "play" || !this.gate.press(source, i)) return;
    const c = this.choices[i];
    this.tweens.add({
      targets: c,
      scaleX: 1.055,
      scaleY: 1.055,
      duration: 85,
      ease: "Sine.Out",
    });
    const bg = c.list[0] as Phaser.GameObjects.Graphics;
    bg.clear();
    const width = c.width,
      height = c.height;
    bg.fillStyle(this.c.press, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 18)
      .lineStyle(2, this.c.sky)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
  }
  private release(source: string) {
    if (this.phase !== "play") return;
    const index = this.gate.release(source);
    if (index === null) return;
    this.resolve(index);
  }
  private cancelPress = () => {
    const i = this.gate.index;
    this.gate.cancel();
    if (i !== null && this.choices[i]) {
      const c = this.choices[i];
      this.tweens.killTweensOf(c);
      c.setScale(1);
      const g = c.list[0] as Phaser.GameObjects.Graphics;
      g.clear()
        .fillStyle(this.c.panel)
        .fillRoundedRect(-c.width / 2, -c.height / 2, c.width, c.height, 18)
        .lineStyle(1, this.c.line)
        .strokeRoundedRect(-c.width / 2, -c.height / 2, c.width, c.height, 18);
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
    this.release(e.code);
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
      this.heartView?.setText(
        Array.from({ length: 5 }, (_, i) =>
          i < this.hearts ? "♥" : "♡",
        ).join(" "),
      );
      this.scoreView?.setText(this.t("正答", "정답") + "  " + this.correct);
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
      const answer = `${this.q.word.term}  ·  ${this.q.word.kana}\n${choiceLabel(this.q.word, "meaning")}`;
      this.status?.setText(
        result === "correct"
          ? `${this.t("正解", "정답")} · ${a.response_ms} ms`
          : result === "timeout"
            ? this.t("時間切れ", "시간 초과")
            : this.t("もう一度、覚えよう", "다시 기억해봐요"),
      );
      if (result !== "correct") {
        this.text(
          this.w / 2,
          this.h * 0.46,
          answer,
          15,
          this.c.ink,
        ).setWordWrapWidth(this.cw - 20, true);
      }
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
        duration: 100,
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
    if (
      this.phase === "paused" ||
      this.phase === "intro" ||
      this.phase === "end"
    )
      return;
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
      this.text(
        this.w / 2,
        this.h / 2 - 100,
        this.t("ひと休み。", "잠시 쉬어가요."),
        30,
      ),
    );
    overlay.add(
      this.text(
        this.w / 2,
        this.h / 2 - 45,
        this.t("時間は止まっています", "시간은 멈춰 있습니다"),
        14,
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
    if (this.phase === "intro") this.drawIntro();
    else if (this.phase === "end") this.drawEnd();
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
export function createTraining(parent: HTMLElement, options: Options) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette[options.preferences.theme].bg,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight,
    },
    render: { antialias: true, pixelArt: false },
    input: { activePointers: 3 },
    scene: [new TrainingScene(options)],
    audio: { noAudio: true },
  });
}
