import { drawPause, drawEnd } from "./overlays";
import { TrainingSession } from "../session";
import Phaser from "phaser";
import {
  AnswerGate,
  keyIndex,
  limitFor,
  FLIGHT_MS,
  CORRECT_FEEDBACK_MS,
  MISTAKE_FEEDBACK_MS,
  START_INPUT_DELAY_MS,
} from "../rules";
import type { Question } from "../types";
import type { Preferences } from "../preferences";
import type { TrainingOptions, Phase } from "./types";
import { TrainingView } from "./board";
import { burst } from "./effects";
import { resizeProgress } from "./resize-progress";
export class TrainingScene extends Phaser.Scene {
  private options: TrainingOptions;
  private prefs: Preferences;
  private view: TrainingView;
  private phase: Phase = "arming";
  private beforePause: Phase = "play";
  private resizeElapsed = 0;
  private afterSettle: Exclude<Phase, "paused" | "settling"> = "play";
  private settleUntil = 0;
  private settleElapsed = 0;
  private gate = new AnswerGate();
  private question!: Question;
  private session = new TrainingSession();
  private get hearts() {
    return this.session.hearts;
  }
  private get correct() {
    return this.session.correct;
  }
  private get logs() {
    return this.session.answers;
  }
  private started = 0;
  private pauseAt = 0;
  private maxTime = 10000;
  private overlay?: Phaser.GameObjects.Container;
  private held = new Set<string>();
  private syncing = false;
  private retryPending = false;
  private syncOK: boolean | null = null;
  private reviewComplete = false;
  private failed = false;
  private viewGeneration = 0;
  constructor(
    options: TrainingOptions,
    private density: number,
  ) {
    super("Training");
    this.options = options;
    this.prefs = options.preferences;
    this.view = new TrainingView(
      this,
      () => this.density,
      () => this.prefs,
      {
        pause: () => this.pause(),
        press: (source, index) => this.press(source, index),
      },
    );
  }
  private get c() {
    return this.view.c;
  }
  private get w() {
    return this.view.w;
  }
  private get h() {
    return this.view.h;
  }
  private t(jp: string, kr: string) {
    return this.view.t(jp, kr);
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
    try {
      this.bootTraining();
      this.game.events.once("postrender", () => {
        if (!this.failed) this.options.onReady?.();
      });
    } catch (error) {
      this.failed = true;
      this.phase = "end";
      this.options.onError?.(error);
    }
  }
  private bootTraining() {
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
  private clear() {
    this.viewGeneration++;
    this.children.removeAll(true);
    this.view.clear();
    this.overlay = undefined;
    this.cameras.main.setBackgroundColor(this.c.bg);
    this.view.backdrop();
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
    this.reviewComplete = false;
    this.session.reset();
    this.options.planner.resetSet();
    this.syncOK = null;
    this.next(true);
  }
  private next(delayInput = false) {
    try {
      const question = this.options.planner.next();
      if (!question) {
        this.finish(true);
        return;
      }
      this.question = question;
    } catch (error) {
      this.phase = "end";
      this.options.onError?.(error);
      return;
    }
    this.maxTime = limitFor(this.correct);
    this.resizeElapsed = 0;
    this.phase = "arming";
    this.gate.close();
    this.drawBoard();
    const generation = this.viewGeneration;
    // The timer starts only after the new question has actually been rendered.
    this.game.events.once("postrender", () => {
      if (this.phase === "arming" && generation === this.viewGeneration) {
        if (delayInput) this.settle("play", 0);
        else {
          this.started = performance.now();
          this.phase = "play";
          this.gate.open();
        }
      }
    });
  }
  private drawBoard() {
    this.clear();
    this.view.drawBoard(this.question, this.hearts, this.correct, this.maxTime);
  }
  update() {
    if (this.phase === "settling") {
      if (performance.now() < this.settleUntil) return;
      this.phase = this.afterSettle;
      if (this.phase === "play") {
        this.started = performance.now() - this.settleElapsed;
        this.gate.open();
      }
      this.time.paused = false;
      this.tweens.resumeAll();
    }
    if (this.phase !== "play") return;
    const elapsed = performance.now() - this.started;
    this.view.drawTime(Math.max(0, 1 - elapsed / this.maxTime));
    this.view.seconds?.setText(
      (Math.max(0, this.maxTime - elapsed) / 1000).toFixed(1),
    );
    if (elapsed >= this.maxTime) this.resolve(null);
  }
  private press(source: string, i: number) {
    if (this.phase !== "play" || !this.gate.claim(source, i)) return;
    const card = this.view.choices[i];
    card.setScale(1.04);
    this.view.paintChoice(card, true);
    // Commit on down; the projectile is visual feedback, not part of response time.
    this.resolve(i);
  }
  private cancelPress = () => {
    const i = this.gate.index;
    this.gate.cancel();
    if (i !== null && this.view.choices[i]) {
      const c = this.view.choices[i];
      this.tweens.killTweensOf(c);
      c.setScale(1);
      this.view.paintChoice(c);
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
    const timeout = index === null || rawElapsed >= this.maxTime;
    this.gate.close();
    this.phase = timeout ? "feedback" : "flight";
    const { answer: a, stats } = this.session.record(
      this.question,
      index,
      rawElapsed,
      this.maxTime,
      this.options.stats,
    );
    this.options.stats = stats;
    this.options.planner.record(a, this.question.word);
    this.options.onAnswer(a);
    const result = a.result;
    const hit = () => {
      this.phase = "feedback";
      this.view.updateHearts(this.hearts);
      this.view.scoreView?.setText(String(this.correct));
      this.view.keyHints?.setVisible(false);
      this.view.status
        ?.setOrigin(0.5)
        .setPosition(this.w / 2, this.view.status.y);
      const at = this.view.wordView!;
      if (result === "correct") {
        burst(this, at.x, at.y, this.c.blue);
        at.setVisible(false);
        this.cameras.main.flash(90, 100, 190, 255, false);
      } else {
        burst(this, at.x, at.y, this.c.red);
        if (index !== null) this.view.choices[index]?.setVisible(false);
        this.cameras.main.shake(110, 0.004);
      }
      this.view.status?.setText(
        result === "correct"
          ? `${this.t("正解", "정답")} · ${a.response_ms} ms`
          : result === "timeout"
            ? this.t("時間切れ", "시간 초과")
            : this.t("もう一度、覚えよう", "다시 기억해봐요"),
      );
      if (result !== "correct") {
        const correctIndex = this.question.options.findIndex(
          (option) => option.id === this.question.word.id,
        );
        const correctChoice = this.view.choices[correctIndex];
        if (correctChoice) {
          this.view.highlightCorrect(correctIndex);
        }
      }
      this.time.delayedCall(
        result === "correct" ? CORRECT_FEEDBACK_MS : MISTAKE_FEEDBACK_MS,
        () => {
          if (this.hearts === 0) this.finish();
          else this.next();
        },
      );
    };
    if (timeout) {
      this.view.drawTime(0);
      hit();
    } else {
      const flying = this.view.choices[index!];
      this.tweens.killTweensOf(flying);
      flying.setDepth(10);
      this.tweens.add({
        targets: flying,
        x: this.view.wordView!.x,
        y: this.view.wordView!.y,
        scaleX: 0.72,
        scaleY: 0.72,
        duration: FLIGHT_MS,
        ease: "Cubic.In",
        onComplete: () => {
          flying.setVisible(false);
          hit();
        },
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
    this.overlay = drawPause(this.view, {
      resume: () => this.resume(),
      finish: () => {
        this.time.paused = false;
        this.tweens.resumeAll();
        this.finish();
      },
      preferences: this.prefs,
      changePreferences: (preferences) => {
        this.prefs = preferences;
        this.options.onPreferences(preferences);
        this.redrawStatic();
      },
    });
  }
  private resume() {
    if (this.phase !== "paused") return;
    this.overlay?.destroy();
    this.overlay = undefined;
    const target =
      this.beforePause === "settling"
        ? this.afterSettle
        : this.beforePause === "arming"
          ? "play"
          : this.beforePause;
    const elapsed =
      this.beforePause === "settling"
        ? this.settleElapsed
        : this.beforePause === "arming"
          ? this.resizeElapsed
          : Math.max(0, this.pauseAt - this.started);
    if (target === "play") {
      this.drawBoard();
      this.view.drawTime(Math.max(0, 1 - elapsed / this.maxTime));
      this.view.seconds?.setText(
        (Math.max(0, this.maxTime - elapsed) / 1000).toFixed(1),
      );
    }
    this.resizeElapsed = 0;
    this.settle(target === "paused" ? "play" : target, elapsed);
  }
  private settle(
    target: Exclude<Phase, "paused" | "settling">,
    elapsed: number,
  ) {
    // Discard input during the grace period; never queue the resume tap as an answer.
    this.phase = "settling";
    this.afterSettle = target;
    this.settleElapsed = elapsed;
    this.settleUntil = performance.now() + START_INPUT_DELAY_MS;
    this.gate.close();
    this.time.paused = true;
    this.tweens.pauseAll();
  }
  private resize() {
    this.syncCamera();
    if (this.phase === "end") {
      this.drawEnd();
      return;
    }
    if (!this.question) return;
    const progress = resizeProgress(
      {
        phase: this.phase,
        beforePause: this.beforePause,
        afterSettle: this.afterSettle,
        started: this.started,
        pauseAt: this.pauseAt,
        resizeElapsed: this.resizeElapsed,
        settleElapsed: this.settleElapsed,
      },
      performance.now(),
      this.maxTime,
    );
    this.gate.close();
    this.time.removeAllEvents();
    this.tweens.killAll();
    if (progress.resolved) {
      if (this.hearts === 0) {
        this.finish();
        return;
      }
      const question = this.options.planner.next();
      if (!question) {
        this.finish(true);
        return;
      }
      this.question = question;
      this.maxTime = limitFor(this.correct);
    }
    this.resizeElapsed = progress.elapsed;
    this.drawBoard();
    if (progress.paused) {
      // Manual/visibility pauses remain paused; resizing alone never opens this overlay.
      this.beforePause = "arming";
      this.drawPause();
      return;
    }
    this.phase = "arming";
    const generation = this.viewGeneration;
    this.game.events.once("postrender", () => {
      if (this.phase === "arming" && generation === this.viewGeneration) {
        this.settle("play", progress.elapsed);
      }
    });
  }
  private finish(reviewComplete = false) {
    this.reviewComplete ||= reviewComplete;
    this.phase = "end";
    this.gate.close();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.time.paused = false;
    this.syncing = true;
    this.drawEnd();
    void this.options
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
  private retry() {
    if (this.syncing || this.retryPending) return;
    this.retryPending = true;
    void this.options
      .onRetry()
      .then((data) => {
        this.options.words = data.words;
        this.options.stats = data.stats;
        if (data.planner) this.options.planner = data.planner;
        this.retryPending = false;
        this.startRun();
      })
      .catch(() => {
        this.retryPending = false;
        this.startRun();
      });
  }
  private drawEnd() {
    this.clear();
    drawEnd(
      this.view,
      {
        reviewComplete: this.reviewComplete,
        answers: this.logs,
        preview: this.options.preview,
        syncing: this.syncing,
        syncOK: this.syncOK,
      },
      {
        retry: () => this.retry(),
        sync: () => this.finish(),
        exit: () => this.options.onExit(),
      },
    );
  }
}
