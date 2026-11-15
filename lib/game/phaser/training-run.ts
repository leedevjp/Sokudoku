import type Phaser from "phaser";
import { AnswerGate, limitFor } from "../rules";
import { TrainingSession } from "../session";
import { BattleProgress } from "../battle-progress";
import { RunPersistence } from "./run-persistence";
import { TrainingInput } from "./training-input";
import { TrainingFeedback } from "./training-feedback";
import { TrainingState } from "./training-state";
import { TrainingAnswers } from "./training-answers";
import { TrainingViewport } from "./training-viewport";
import { TrainingPresentation } from "./training-presentation";
import type { TrainingOptions } from "./types";

/** Coordinates question/run transitions; rendering and restoration have their own owners. */
export class TrainingRun {
  readonly presentation: TrainingPresentation;
  readonly viewport: TrainingViewport;
  private state = new TrainingState();
  private gate = new AnswerGate();
  private session = new TrainingSession();
  private battleProgress = new BattleProgress();
  private persistence = new RunPersistence();
  private reviewComplete = false;
  private answers: TrainingAnswers;
  private feedback = new TrainingFeedback({
    canAdvance: () => this.state.phase === "feedback",
    advance: () => { if (this.session.hearts === 0) this.finish(); else void this.next(); },
    delay: (milliseconds, callback) => { this.scene.time.delayedCall(milliseconds, callback); },
  });
  private input = new TrainingInput({
    phase: () => this.state.phase,
    press: (source, index) => this.answers.press(source, index),
    correct: (index) => this.answers.finishCorrection(index),
    toggleCorrection: () => this.answers.toggleCorrection(),
    pause: () => this.viewport.pause(),
    resume: () => this.viewport.resume(),
    hidden: () => this.hidden(),
    cancel: () => this.answers.cancelPress(),
  });

  constructor(private scene: Phaser.Scene, private options: TrainingOptions, density: number) {
    this.presentation = new TrainingPresentation(scene, options, this.state, this.session, this.battleProgress, density, {
      pause: () => this.viewport.pause(),
      resume: () => this.viewport.resume(),
      press: (source, index) => this.answers.press(source, index),
      toggleSound: () => this.toggleAllSound(),
      finish: (complete) => this.finish(complete),
      showResult: () => this.drawEnd(),
      clearCorrectionView: () => this.answers.clearView(),
    });
    this.answers = new TrainingAnswers(
      this.scene, this.state, this.session, this.gate, this.presentation.view, this.feedback, this.presentation.petMotion, this.battleProgress,
      {
        options: () => this.options,
        preferences: () => this.presentation.preferences,
        audio: () => this.presentation.audio,
        battle: () => this.presentation.battle,
        reducedMotion: () => this.presentation.motionReduced,
        paintPet: () => this.presentation.paintPet(),
      },
    );
    this.viewport = new TrainingViewport(this.scene, this.state, this.session, this.gate, this.presentation.view, {
      planner: () => this.options.planner,
      timeLimited: () => this.timeLimited,
      hasCorrection: () => this.answers.correcting,
      stopSound: () => { this.presentation.audio?.stop(); this.feedback.stopSpeech(); },
      cancelPress: () => this.answers.cancelPress(),
      closePause: () => this.presentation.closePause(),
      drawPause: () => this.presentation.drawPause(),
      drawBoard: () => this.presentation.drawBoard(),
      drawCorrection: () => this.answers.renderCorrection(),
      drawEnd: () => this.drawEnd(),
      syncCamera: () => this.presentation.syncCamera(),
      feedbackReady: () => this.feedback.tryAdvance(),
      finish: (reviewComplete) => this.finish(reviewComplete),
      error: (error) => this.options.onError?.(error),
    });
  }
  private get timeLimited() { return this.options.timeLimited !== false; }
  initialize() {
    this.presentation.initializeViewport();
    this.input.attach();
    this.presentation.initializeMedia();
  }
  start() { this.startRun(true); }
  fail(error: unknown) {
    this.presentation.markFailed();
    this.state.phase = "end";
    this.options.onError?.(error);
  }
  close() {
    this.presentation.closePause();
    this.feedback.stopSpeech();
    this.state.nextGeneration++;
    this.input.detach();
    this.presentation.closeMedia();
  }
  private startRun(usePreparedFirstSet = false) {
    if (this.persistence.saving) return;
    this.feedback.reset();
    this.state.pauseRequested = false;
    this.reviewComplete = false;
    this.answers.reset();
    this.session.reset();
    this.battleProgress.reset();
    this.presentation.petMotion.play("hop");
    if (!usePreparedFirstSet) this.options.planner.resetSet();
    this.persistence.reset();
    void this.next(true);
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
    this.presentation.drawBoard();
    const generation = this.state.viewGeneration;
    // The timer starts only after the new question has actually been rendered.
    this.scene.game.events.once("postrender", () => {
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
  /** The HUD mute is a master switch for BGM, effects and speech synthesis. */
  private toggleAllSound() {
    if (!this.presentation.audio) return;
    this.presentation.audio.toggle();
    if (!this.presentation.audio.enabled) {
      // Cancel any ongoing reading and release the answer-advance gate.
      this.feedback.stopSpeech();
      this.feedback.tryAdvance();
    }
  }
  private hidden = () => {
    this.input.clear();
    if (this.timeLimited) this.viewport.pause();
    else {
      this.presentation.audio?.stop();
      this.feedback.stopSpeech();
    }
  };
  private finish(reviewComplete = false) {
    this.presentation.closePause();
    this.presentation.audio?.stop();
    this.feedback.stopSpeech();
    this.state.nextGeneration++;
    this.state.preparingQuestion = false;
    this.state.pauseRequested = false;
    this.answers.reset();
    this.reviewComplete ||= reviewComplete;
    this.state.phase = "end";
    this.presentation.petMotion.play(this.reviewComplete ? "celebrate" : "happy");
    this.gate.close();
    this.scene.time.removeAllEvents();
    this.scene.tweens.killAll();
    this.scene.time.paused = false;
    this.persistence.save(
      async () => {
        return this.options.onFinish();
      },
      () => this.scene.sys.isActive(),
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
  update(delta: number) {
    this.presentation.update(delta);
    if (!this.viewport.update()) return;
    if (this.state.phase === "correction" && this.answers.correcting) {
      this.answers.update(delta);
      return;
    }
    if (this.state.phase !== "play") return;
    const elapsed = performance.now() - this.state.started;
    if (this.timeLimited) {
      this.presentation.view.drawTime(Math.max(0, 1 - elapsed / this.state.maxTime));
      this.presentation.view.seconds?.setText((Math.max(0, this.state.maxTime - elapsed) / 1000).toFixed(1));
      if (elapsed >= this.state.maxTime) this.answers.timeout();
    }
  }
  private drawEnd() {
    this.presentation.drawResult(
      () => ({
        reviewComplete: this.reviewComplete,
        progress: this.options.planner.progress(),
        answers: this.session.answers,
        preview: this.options.preview,
        syncing: this.persistence.saving,
        syncOK: this.persistence.saved,
      }),
      {
        retry: () => this.retry(),
        sync: () => this.finish(),
        exit: () => this.options.onExit(),
        exam: () => this.options.onExam(),
      },
    );
  }
}
