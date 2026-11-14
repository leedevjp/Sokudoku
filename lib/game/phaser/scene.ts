import { MeadowBattle } from "./meadow-battle";
import { RabbitCompanion } from "./rabbit-companion";
import { SceneMedia } from "./scene-media";
import { battleReady } from "./presentation-assets";
import { PetMotionState } from "../pet-motion";
import { RunPersistence } from "./run-persistence";
import { TrainingInput } from "./training-input";
import { drawPause } from "./pause-overlay";
import { drawTrainingResult } from "./result-presentation";
import { TrainingFeedback } from "./training-feedback";
import { TrainingSession } from "../session";
import Phaser from "phaser";
import { AnswerGate, limitFor } from "../rules";
import type { Preferences } from "../preferences";
import type { TrainingOptions } from "./types";
import { TrainingView } from "./board";
import { TrainingState } from "./training-state";
import { TrainingViewport } from "./training-viewport";
import { BattleProgress } from "../battle-progress";
import { BattleAudio } from "./battle-audio";
import { TrainingAnswers } from "./training-answers";
export class TrainingScene extends Phaser.Scene {
  private pet?: RabbitCompanion;
  private battle?: MeadowBattle;
  private petMotion = new PetMotionState();
  private reducedMotion?: MediaQueryList;
  private options: TrainingOptions;
  private prefs: Preferences;
  private view: TrainingView;
  private state = new TrainingState();
  private viewport: TrainingViewport;
  private gate = new AnswerGate();
  private session = new TrainingSession();
  private battleProgress = new BattleProgress();
  private battleAudio?: BattleAudio;
  private media?: SceneMedia;
  private soundExpanded = false;
  private feedback = new TrainingFeedback({
    canAdvance: () => this.state.phase === "feedback",
    advance: () => {
      if (this.session.hearts === 0) this.finish();
      else void this.next();
    },
    delay: (milliseconds, callback) => { this.time.delayedCall(milliseconds, callback); },
  });
  private get timeLimited() { return this.options.timeLimited !== false; }
  private overlay?: Phaser.GameObjects.Container;
  private trainingInput = new TrainingInput({
    phase: () => this.state.phase,
    press: (source, index) => this.answers.press(source, index),
    correct: (index) => this.answers.finishCorrection(index),
    toggleCorrection: () => this.answers.toggleCorrection(),
    pause: () => this.viewport.pause(),
    resume: () => this.viewport.resume(),
    hidden: () => this.hidden(),
    cancel: () => this.answers.cancelPress(),
  });
  private persistence = new RunPersistence();
  private reviewComplete = false;
  private failed = false;
  private readyNotified = false;
  private answers: TrainingAnswers;
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
        pause: () => this.viewport.pause(),
        toggleSound: () => this.toggleAllSound(),
        soundEnabled: () => this.battleAudio?.enabled ?? false,
        press: (source, index) => this.answers.press(source, index),
      },
    );
    this.answers = new TrainingAnswers(
      this, this.state, this.session, this.gate, this.view, this.feedback, this.petMotion, this.battleProgress,
      {
        options: () => this.options,
        preferences: () => this.prefs,
        audio: () => this.battleAudio,
        battle: () => this.battle,
        reducedMotion: () => this.reducedMotion?.matches ?? false,
        paintPet: () => this.paintPet(),
      },
    );
    this.viewport = new TrainingViewport(this, this.state, this.session, this.gate, this.view, {
      planner: () => this.options.planner,
      timeLimited: () => this.timeLimited,
      hasCorrection: () => this.answers.correcting,
      stopSound: () => { this.battleAudio?.stop(); this.feedback.stopSpeech(); },
      cancelPress: () => this.answers.cancelPress(),
      closePause: () => { this.overlay?.destroy(); this.overlay = undefined; },
      drawPause: () => this.drawPause(),
      drawBoard: () => this.drawBoard(),
      drawCorrection: () => this.answers.renderCorrection(),
      drawEnd: () => this.drawEnd(),
      syncCamera: () => this.syncCamera(),
      feedbackReady: () => this.feedback.tryAdvance(),
      finish: (reviewComplete) => this.finish(reviewComplete),
      error: (error) => this.options.onError?.(error),
    });
  }
  setRenderDensity(value: number) {
    this.density = value;
  }
  private syncCamera() {
    // World units remain CSS pixels; only the framebuffer and camera are high-DPI.
    this.cameras.main
      .setViewport(0, 0, this.scale.width, this.scale.height)
      .setZoom(this.density)
      .centerOn(this.view.w / 2, this.view.h / 2);
  }
  create() {
    try {
      this.bootTraining();
    } catch (error) {
      this.failed = true;
      this.state.phase = "end";
      this.options.onError?.(error);
    }
  }
  private bootTraining() {
    this.syncCamera();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.game.canvas.setAttribute(
      "aria-label",
      this.view.t(
        "単語トレーニング。数字1〜4を押した瞬間に回答。Escapeで一時停止。",
        "단어 훈련. 숫자 1~4를 누르는 순간 답하기. Escape로 일시정지.",
      ),
    );
    this.game.canvas.setAttribute("tabindex", "0");
    this.trainingInput.attach();
    this.battleAudio = new BattleAudio(this);
    this.media = new SceneMedia(this, () => this.attachBattleWhenReady());
    this.scale.on("resize", this.viewport.resize, this.viewport);
    const cleanup = () => {
      this.overlay?.destroy(); this.overlay = undefined;
      this.feedback.stopSpeech(); this.state.nextGeneration++; this.trainingInput.detach();
      this.media?.close();
      this.events.off("shutdown", cleanup); this.events.off("destroy", cleanup);
    };
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
    this.startRun(true);
    // Render and enable the quiz before any presentation downloads/decoding.
    this.game.events.once("postrender", () => {
      if (!this.sys.isActive()) return;
      this.media?.start();
    });
  }
  private clear() {
    this.pet = undefined;
    this.battle = undefined;
    this.state.viewGeneration++;
    this.children.removeAll(true);
    this.view.clear();
    this.answers.clearView();
    this.overlay = undefined;
    this.cameras.main.setBackgroundColor(this.view.c.bg);
    this.view.backdrop();
  }
  private redrawStatic() {
    if (this.state.phase === "end") this.drawEnd();
    else if (this.state.phase === "paused") {
      this.cameras.main.setBackgroundColor(this.view.c.bg);
      this.drawPause();
    }
  }
  private startRun(usePreparedFirstSet = false) {
    if (this.persistence.saving) return;
    this.feedback.reset();
    this.state.pauseRequested = false;
    this.reviewComplete = false;
    this.answers.reset();
    this.session.reset();
    this.battleProgress.reset();
    this.petMotion.play("hop");
    if (!usePreparedFirstSet) this.options.planner.resetSet();
    this.persistence.reset();
    this.next(true);
  }
  private async next(delayInput = false) {
    this.feedback.reset();
    const request = ++this.state.nextGeneration;
    this.state.phase = "arming";
    this.gate.close();
    this.state.preparingQuestion = true;
    this.answers.reset();
    try {
      await this.options.planner.prepareSet();
      if (request !== this.state.nextGeneration) return;
      this.state.preparingQuestion = false;
      const question = this.options.planner.next();
      if (!question) {
        this.finish(true);
        return;
      }
      this.state.question = question;
    } catch (error) {
      if (request !== this.state.nextGeneration) return;
      this.state.preparingQuestion = false;
      this.state.phase = "end";
      this.options.onError?.(error);
      return;
    }
    this.state.maxTime = limitFor(this.session.correct);
    this.state.resizeElapsed = 0;
    this.state.phase = "arming";
    this.gate.close();
    this.drawBoard();
    const generation = this.state.viewGeneration;
    // The timer starts only after the new question has actually been rendered.
    this.game.events.once("postrender", () => {
      if (this.state.phase === "arming" && generation === this.state.viewGeneration) {
        if (this.state.pauseRequested || (this.timeLimited && document.hidden)) {
          this.state.pauseRequested = false;
          this.viewport.pause();
          return;
        }
        if (delayInput) this.viewport.settle("play", 0);
        else {
          this.state.started = performance.now();
          this.state.phase = "play";
          this.gate.open();
        }
      }
    });
  }
  private drawBoard() {
    this.clear();
    this.view.drawBoard(this.state.question, this.session.hearts, this.session.correct, this.state.maxTime, this.timeLimited);
    this.attachBattleWhenReady();
    this.notifyReady();
  }
  private attachBattleWhenReady() {
    // The quiz is intentionally shown before its artwork loads. Attach the
    // actors to the already visible question once every battle texture exists,
    // without rebuilding the board, resetting input or restarting the timer.
    if (!battleReady(key => this.textures.exists(key))) return;
    if (this.state.preparingQuestion || !this.state.question || this.battle ||
        !["arming", "play", "settling"].includes(this.state.phase)) return;
    this.battle = new MeadowBattle(this, this.view, this.state.question.word.id, this.session.correct, this.battleProgress.combo);
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
    this.battleAudio?.update(!["paused", "end"].includes(this.state.phase), delta);
    this.petMotion.tick(
      delta,
      this.state.phase === "paused" || this.state.phase === "settling",
    );
    this.paintPet();
    this.battle?.update(
      delta,
      this.state.phase === "paused" || this.state.phase === "settling",
      this.reducedMotion?.matches ?? false,
    );
    if (!this.viewport.update()) return;
    if (this.state.phase === "correction" && this.answers.correcting) {
      this.answers.update(delta);
      return;
    }
    if (this.state.phase !== "play") return;
    const elapsed = performance.now() - this.state.started;
    if (this.timeLimited) {
      this.view.drawTime(Math.max(0, 1 - elapsed / this.state.maxTime));
      this.view.seconds?.setText((Math.max(0, this.state.maxTime - elapsed) / 1000).toFixed(1));
      if (elapsed >= this.state.maxTime) this.answers.timeout();
    }
  }
  /** The HUD mute is a master switch for BGM, effects and speech synthesis. */
  private toggleAllSound() {
    if (!this.battleAudio) return;
    this.battleAudio.toggle();
    if (!this.battleAudio.enabled) {
      // Cancel any ongoing reading and release the answer-advance gate.
      this.feedback.stopSpeech();
      this.feedback.tryAdvance();
    }
  }
  private hidden = () => {
    this.trainingInput.clear();
    if (this.timeLimited) this.viewport.pause();
    else {
      this.battleAudio?.stop();
      this.feedback.stopSpeech();
    }
  };
  private drawPause() {
    this.overlay?.destroy();
    this.overlay = drawPause(this.view, {
      resume: () => this.viewport.resume(),
      finish: () => {
        // DOM controls live outside the Phaser display list. Dispose them first
        // so a saving/result screen can never remain hidden behind the pause UI.
        this.overlay?.destroy();
        this.overlay = undefined;
        this.time.paused = false;
        this.tweens.resumeAll();
        this.finish(false, true);
      },
      preferences: this.prefs,
      audio: this.battleAudio,
      toggleSound: () => this.toggleAllSound(),
      soundExpanded: this.soundExpanded,
      setSoundExpanded: (expanded) => { this.soundExpanded = expanded; },
      changePreferences: (preferences) => {
        this.prefs = preferences;
        this.options.onPreferences(preferences);
        this.redrawStatic();
      },
    });
  }
  private finish(reviewComplete = false, exitAfterSave = false) {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.battleAudio?.stop();
    this.feedback.stopSpeech();
    this.state.nextGeneration++;
    this.state.preparingQuestion = false;
    this.state.pauseRequested = false;
    this.answers.reset();
    this.reviewComplete ||= reviewComplete;
    this.state.phase = "end";
    this.petMotion.play(this.reviewComplete ? "celebrate" : "happy");
    this.gate.close();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.time.paused = false;
    this.persistence.save(
      async () => {
        const saved = await this.options.onFinish();
        if (saved && exitAfterSave) this.options.onExit();
        return saved;
      },
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
    // Result redraws can run repeatedly during async save completion.
    // Ensure an old pause DOM overlay never intercepts the result controls.
    this.overlay?.destroy();
    this.overlay = undefined;
    this.tweens.killAll();
    this.notifyReady();
    this.clear();
    this.pet = drawTrainingResult(
      this, this.view, this.session.correct,
      {
        reviewComplete: this.reviewComplete,
        progress: this.options.planner.progress(),
        answers: this.session.answers,
        preview: this.options.preview,
        syncing: this.persistence.saving,
        syncOK: this.persistence.saved,
      },
      {
        retry: () => this.retry(),
        sync: () => this.finish(),
        exit: () => this.options.onExit(),
        exam: () => this.options.onExam(),
      },
    );
    this.paintPet();
  }
}
