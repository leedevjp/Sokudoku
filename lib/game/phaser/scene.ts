import { MeadowBattle, preloadBattle } from "./meadow-battle";
import { RabbitCompanion, preloadRabbit } from "./rabbit-companion";
import { PetMotionState } from "../pet-motion";
import { RunPersistence } from "./run-persistence";
import { paintAnswerFeedback } from "./answer-feedback";
import { TrainingInput } from "./training-input";
import { drawPause } from "./pause-overlay";
import { drawEnd } from "./result-overlay";
import { TrainingSession } from "../session";
import Phaser from "phaser";
import {
  AnswerGate,
  limitFor,
  CORRECT_FEEDBACK_MS,
  START_INPUT_DELAY_MS,
} from "../rules";
import type { Question } from "../types";
import type { Preferences } from "../preferences";
import type { TrainingOptions, Phase } from "./types";
import { TrainingView } from "./board";
import { answerImpact, burst } from "./effects";
import { resizeProgress } from "./resize-progress";
import { Correction } from "../correction";
import { BattleProgress, comboTier } from "../battle-progress";
import { BattleAudio, preloadBattleAudio } from "./battle-audio";
import { openSoundSettings } from "./sound-settings";
import type { CorrectionCard } from "./correction-card";
import { showCorrection } from "./correction-presentation";
export class TrainingScene extends Phaser.Scene {
  private pet?: RabbitCompanion;
  private battle?: MeadowBattle;
  private petMotion = new PetMotionState();
  private reducedMotion?: MediaQueryList;
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
  private battleProgress = new BattleProgress();
  private battleAudio?: BattleAudio;
  private closeSoundSettings?: () => void;
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
  private trainingInput = new TrainingInput({
    phase: () => this.phase,
    press: (source, index) => this.press(source, index),
    correct: (index) => this.finishCorrection(index),
    toggleCorrection: () => this.toggleCorrection(),
    pause: () => this.pause(),
    resume: () => this.resume(),
    hidden: () => this.hidden(),
    cancel: () => this.cancelPress(),
  });
  private persistence = new RunPersistence();
  private reviewComplete = false;
  private failed = false;
  private viewGeneration = 0;
  private nextGeneration = 0;
  private preparingQuestion = false;
  private pauseRequested = false;
  private readyNotified = false;
  private correction?: Correction;
  private correctionView?: CorrectionCard;
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
        toggleSound: () => this.battleAudio?.toggle(),
        soundEnabled: () => this.battleAudio?.enabled ?? false,
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
  preload() {
    preloadRabbit(this);
    preloadBattle(this);
    preloadBattleAudio(this);
  }
  create() {
    try {
      this.bootTraining();
    } catch (error) {
      this.failed = true;
      this.phase = "end";
      this.options.onError?.(error);
    }
  }
  private bootTraining() {
    this.syncCamera();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.game.canvas.setAttribute(
      "aria-label",
      this.t(
        "単語トレーニング。数字1〜4を押した瞬間に回答。Escapeで一時停止。",
        "단어 훈련. 숫자 1~4를 누르는 순간 답하기. Escape로 일시정지.",
      ),
    );
    this.game.canvas.setAttribute("tabindex", "0");
    this.trainingInput.attach();
    this.battleAudio = new BattleAudio(this);
    this.scale.on("resize", this.resize, this);
    this.events.once("shutdown", () => { this.closeSoundSettings?.(); this.nextGeneration++; this.trainingInput.detach(); });
    this.startRun();
  }
  private clear() {
    this.pet = undefined;
    this.battle = undefined;
    this.viewGeneration++;
    this.children.removeAll(true);
    this.view.clear();
    this.correctionView = undefined;
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
    if (this.persistence.saving) return;
    this.pauseRequested = false;
    this.reviewComplete = false;
    this.correction = undefined;
    this.session.reset();
    this.battleProgress.reset();
    this.petMotion.play("hop");
    this.options.planner.resetSet();
    this.persistence.reset();
    this.next(true);
  }
  private async next(delayInput = false) {
    const request = ++this.nextGeneration;
    this.phase = "arming";
    this.gate.close();
    this.preparingQuestion = true;
    this.correction = undefined;
    try {
      await this.options.planner.prepareSet();
      if (request !== this.nextGeneration) return;
      this.preparingQuestion = false;
      const question = this.options.planner.next();
      if (!question) {
        this.finish(true);
        return;
      }
      this.question = question;
    } catch (error) {
      if (request !== this.nextGeneration) return;
      this.preparingQuestion = false;
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
        if (this.pauseRequested || document.hidden) {
          this.pauseRequested = false;
          this.pause();
          return;
        }
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
    this.battle = new MeadowBattle(this, this.view, this.question.word.id, this.correct, this.battleProgress.combo);
    this.notifyReady();
  }
  private notifyReady() {
    if (this.readyNotified) return;
    this.readyNotified = true;
    this.game.events.once("postrender", () => { if (!this.failed) this.options.onReady?.(); });
  }
  private paintPet() {
    this.pet?.show(
      this.petMotion.motion,
      this.petMotion.elapsed,
      this.reducedMotion?.matches ?? false,
    );
  }
  update(_time: number, delta: number) {
    this.battleAudio?.update(!["paused", "end"].includes(this.phase), delta);
    this.petMotion.tick(
      delta,
      this.phase === "paused" || this.phase === "settling",
    );
    this.paintPet();
    this.battle?.update(
      delta,
      this.phase === "paused" || this.phase === "settling",
      this.reducedMotion?.matches ?? false,
    );
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
    if (this.phase === "correction" && this.correction) {
      const expired = this.correction.tick(delta);
      this.correctionView?.update(this.correction);
      if (expired) this.finishCorrection();
      return;
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
    this.battleProgress.record(result);
    const tier = comboTier(this.battleProgress.combo);
    this.battleAudio?.play(result === "timeout" ? "jelly" : "dash", result === "timeout" ? .10 : .12);
    this.correction =
      result === "correct" ? undefined : new Correction(this.question);
    const hit = () => {
      if (result === "correct") this.battleAudio?.impact(tier);
      else if (result === "incorrect") this.battleAudio?.play("jelly", .12);
      this.phase = "feedback";
      paintAnswerFeedback(this.view, a, this.hearts, this.correct);
      this.petMotion.play(result === "correct" ? "happy" : "encourage");
      this.paintPet();
      if (this.correction) {
        this.phase = "correction";
        this.renderCorrection(true);
        return;
      }
      this.advanceAfterFeedback();
    };
    const impact = () =>
      answerImpact(this, this.view, index, result, hit, false);
    if (this.battle)
      this.battle.attack(result, this.reducedMotion?.matches ?? false, impact, this.battleProgress.combo);
    else impact();
  }

  private renderCorrection(animate = false) {
    const correction = this.correction;
    if (!correction) return;
    this.petMotion.play("encourage");
    this.paintPet();
    this.correctionView = showCorrection(
      this,
      this.view,
      correction,
      this.logs.at(-1),
      this.maxTime,
      {
        advance: () => this.finishCorrection(),
        toggle: () => this.toggleCorrection(),
        enabled: () => this.phase === "correction",
      },
      animate,
    );
  }
  private toggleCorrection() {
    if (this.phase !== "correction" || !this.correction) return;
    this.correction.toggle();
    this.correctionView?.update(this.correction);
  }
  private finishCorrection(index?: number) {
    if (this.phase !== "correction" || !this.correction?.complete(index))
      return;
    this.phase = "feedback";
    this.correction = undefined;
    this.petMotion.play("happy");
    const card = this.correctionView?.root;
    if (card) {
      burst(this, card.x, card.y, this.c.blue);
      card.disableInteractive().setVisible(false);
    }
    this.advanceAfterFeedback();
  }
  private advanceAfterFeedback() {
    this.time.delayedCall(CORRECT_FEEDBACK_MS, () => {
      if (this.hearts === 0) this.finish();
      else this.next();
    });
  }
  private hidden = () => {
    this.trainingInput.clear();
    this.pause();
  };
  private pause() {
    this.battleAudio?.stop();
    if (this.preparingQuestion) { this.pauseRequested = true; return; }
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
      openSoundSettings: () => {
        if (!this.battleAudio || this.closeSoundSettings) return;
        this.closeSoundSettings = openSoundSettings(this.battleAudio, (jp, kr) => this.t(jp, kr), () => { this.closeSoundSettings = undefined; });
      },
      changePreferences: (preferences) => {
        this.prefs = preferences;
        this.options.onPreferences(preferences);
        this.redrawStatic();
      },
    });
  }
  private resume() {
    if (this.closeSoundSettings) { this.closeSoundSettings(); return; }
    if (this.phase !== "paused") return;
    this.overlay?.destroy();
    this.overlay = undefined;
    const target = this.correction
      ? "correction"
      : this.beforePause === "settling"
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
    } else if (target === "correction") {
      this.tweens.killAll();
      this.drawBoard();
      this.renderCorrection();
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
  private async resize() {
    this.syncCamera();
    if (this.preparingQuestion) return;
    if (this.phase === "end") {
      this.drawEnd();
      return;
    }
    if (!this.question) return;
    // Keep the same wrong answer, remaining review time and local pause state
    // through rotation, browser chrome changes, and global pause/resume.
    if (this.correction) {
      const paused = this.phase === "paused";
      this.gate.close();
      this.time.removeAllEvents();
      this.tweens.killAll();
      this.drawBoard();
      this.renderCorrection();
      if (paused) {
        this.beforePause = "correction";
        this.drawPause();
      } else this.settle("correction", 0);
      return;
    }
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
      let question: Question | null;
      const request = ++this.nextGeneration;
      this.preparingQuestion = true;
      this.phase = "arming";
      try {
        await this.options.planner.prepareSet();
        if (request !== this.nextGeneration) return;
        this.preparingQuestion = false;
        question = this.options.planner.next();
      } catch (error) {
        if (request !== this.nextGeneration) return;
        this.preparingQuestion = false;
        this.phase = "end";
        this.options.onError?.(error);
        return;
      }
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
      this.phase = "paused";
      this.pauseRequested = false;
      this.drawPause();
      return;
    }
    this.phase = "arming";
    const generation = this.viewGeneration;
    this.game.events.once("postrender", () => {
      if (this.phase === "arming" && generation === this.viewGeneration) {
        if (this.pauseRequested || document.hidden) {
          this.pauseRequested = false;
          this.pause();
          return;
        }
        this.settle("play", progress.elapsed);
      }
    });
  }
  private finish(reviewComplete = false) {
    this.battleAudio?.stop();
    this.nextGeneration++;
    this.preparingQuestion = false;
    this.pauseRequested = false;
    this.correction = undefined;
    this.reviewComplete ||= reviewComplete;
    this.phase = "end";
    this.petMotion.play(this.reviewComplete ? "celebrate" : "happy");
    this.gate.close();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.time.paused = false;
    this.persistence.save(
      this.options.onFinish,
      () => this.sys.isActive(),
      () => this.drawEnd(),
    );
  }
  private retry() {
    this.persistence.retry(
      this.options.onRetry,
      (data) => {
        this.options.words = data.words;
        this.options.stats = data.stats;
        if (data.planner) this.options.planner = data.planner;
        this.startRun();
      },
      () => this.startRun(),
    );
  }
  private drawEnd() {
    this.notifyReady();
    this.clear();
    this.game.canvas.setAttribute(
      "aria-label",
      [
        this.t("結果", "결과"),
        this.t("正答", "정답") + " " + this.correct,
        this.t("回答", "답변") + " " + this.logs.length,
      ].join(" / "),
    );
    drawEnd(
      this.view,
      {
        reviewComplete: this.reviewComplete,
        progress: this.options.planner.progress(),
        answers: this.logs,
        preview: this.options.preview,
        syncing: this.persistence.saving,
        syncOK: this.persistence.saved,
      },
      {
        retry: () => this.retry(),
        sync: () => this.finish(),
        exit: () => this.options.onExit(),
      },
    );
    const s = Math.min(1, (this.h - 32) / 680);
    const width = Math.min(this.w - 32, 500);
    this.pet = new RabbitCompanion(
      this,
      this.w / 2 + width / 2 - 65 * s,
      this.h / 2 - 225 * s,
      100 * s,
    );
    this.paintPet();
  }
}
