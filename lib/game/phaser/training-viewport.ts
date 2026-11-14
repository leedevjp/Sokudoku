import type Phaser from "phaser";
import { limitFor, START_INPUT_DELAY_MS, type AnswerGate } from "../rules";
import type { Question } from "../types";
import type { TrainingSession } from "../session";
import type { TrainingPlanner } from "../learning/planner";
import type { TrainingView } from "./board";
import type { Phase } from "./types";
import type { TrainingState } from "./training-state";
import { resizeProgress } from "./resize-progress";

type ViewportActions = {
  planner: () => TrainingPlanner;
  timeLimited: () => boolean;
  hasCorrection: () => boolean;
  stopSound: () => void;
  cancelPress: () => void;
  closePause: () => void;
  drawPause: () => void;
  drawBoard: () => void;
  drawCorrection: () => void;
  drawEnd: () => void;
  syncCamera: () => void;
  feedbackReady: () => void;
  finish: (reviewComplete?: boolean) => void;
  error: (error: unknown) => void;
};

/** Restores the same run across pause, input grace periods and viewport changes. */
export class TrainingViewport {
  constructor(
    private scene: Phaser.Scene,
    private state: TrainingState,
    private session: TrainingSession,
    private gate: AnswerGate,
    private view: TrainingView,
    private actions: ViewportActions,
  ) {}

  /** False keeps the scene's update loop idle during the existing input grace period. */
  update(): boolean {
    if (this.state.phase === "settling") {
      if (performance.now() < this.state.settleUntil) return false;
      this.state.phase = this.state.afterSettle;
      if (this.state.phase === "play") {
        this.state.started = performance.now() - this.state.settleElapsed;
        this.gate.open();
      }
      this.scene.time.paused = false;
      this.scene.tweens.resumeAll();
      if (this.state.phase === "feedback") this.actions.feedbackReady();
    }
    return true;
  }
  pause() {
    this.actions.stopSound();
    if (this.state.preparingQuestion) { this.state.pauseRequested = true; return; }
    if (this.state.phase === "paused" || this.state.phase === "end") return;
    this.state.beforePause = this.state.phase;
    this.state.pauseAt = performance.now();
    this.actions.cancelPress();
    this.state.phase = "paused";
    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
    this.actions.drawPause();
  }
  resume() {
    if (this.state.phase !== "paused") return;
    this.actions.closePause();
    const target = this.actions.hasCorrection()
      ? "correction"
      : this.state.beforePause === "settling"
        ? this.state.afterSettle
        : this.state.beforePause === "arming"
          ? "play"
          : this.state.beforePause;
    const elapsed =
      this.state.beforePause === "settling"
        ? this.state.settleElapsed
        : this.state.beforePause === "arming"
          ? this.state.resizeElapsed
          : Math.max(0, this.state.pauseAt - this.state.started);
    if (target === "play") {
      this.actions.drawBoard();
      if (this.actions.timeLimited()) {
        this.view.drawTime(Math.max(0, 1 - elapsed / this.state.maxTime));
        this.view.seconds?.setText((Math.max(0, this.state.maxTime - elapsed) / 1000).toFixed(1));
      }
    } else if (target === "correction") {
      this.scene.tweens.killAll();
      this.actions.drawBoard();
      this.actions.drawCorrection();
    }
    this.state.resizeElapsed = 0;
    this.settle(target === "paused" ? "play" : target, elapsed);
  }
  settle(
    target: Exclude<Phase, "paused" | "settling">,
    elapsed: number,
  ) {
    // Discard input during the grace period; never queue the resume tap as an answer.
    this.state.phase = "settling";
    this.state.afterSettle = target;
    this.state.settleElapsed = elapsed;
    this.state.settleUntil = performance.now() + START_INPUT_DELAY_MS;
    this.gate.close();
    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
  }
  async resize() {
    this.actions.syncCamera();
    if (this.state.preparingQuestion) return;
    if (this.state.phase === "end") {
      this.actions.drawEnd();
      return;
    }
    if (!this.state.question) return;
    // Keep the same wrong answer, remaining review time and local pause state
    // through rotation, browser chrome changes, and global pause/resume.
    if (this.actions.hasCorrection()) {
      const paused = this.state.phase === "paused";
      this.gate.close();
      this.scene.time.removeAllEvents();
      this.scene.tweens.killAll();
      this.actions.drawBoard();
      this.actions.drawCorrection();
      if (paused) {
        this.state.beforePause = "correction";
        this.actions.drawPause();
      } else this.settle("correction", 0);
      return;
    }
    // A resize during answer animation or pronunciation is visual only.
    // Do not classify the answered question as consumed or end the run.
    if (this.state.phase === "flight" || this.state.phase === "feedback") return;
    // Paused settings must never consume the current question on viewport changes.
    if (this.state.phase === "paused" && (this.state.beforePause === "flight" || this.state.beforePause === "feedback")) {
      this.actions.drawPause();
      return;
    }
    const progress = resizeProgress(
      {
        phase: this.state.phase,
        beforePause: this.state.beforePause,
        afterSettle: this.state.afterSettle,
        started: this.state.started,
        pauseAt: this.state.pauseAt,
        resizeElapsed: this.state.resizeElapsed,
        settleElapsed: this.state.settleElapsed,
      },
      performance.now(),
      this.actions.timeLimited() ? this.state.maxTime : Number.MAX_SAFE_INTEGER,
    );
    this.gate.close();
    this.scene.time.removeAllEvents();
    this.scene.tweens.killAll();
    if (progress.resolved) {
      if (this.session.hearts === 0) {
        this.actions.finish();
        return;
      }
      let question: Question | null;
      const request = ++this.state.nextGeneration;
      this.state.preparingQuestion = true;
      this.state.phase = "arming";
      try {
        await this.actions.planner().prepareSet();
        if (request !== this.state.nextGeneration) return;
        this.state.preparingQuestion = false;
        question = this.actions.planner().next();
      } catch (error) {
        if (request !== this.state.nextGeneration) return;
        this.state.preparingQuestion = false;
        this.state.phase = "end";
        this.actions.error(error);
        return;
      }
      if (!question) {
        this.actions.finish(true);
        return;
      }
      this.state.question = question;
      this.state.maxTime = limitFor(this.session.correct);
    }
    this.state.resizeElapsed = progress.elapsed;
    this.actions.drawBoard();
    if (progress.paused) {
      // Manual/visibility pauses remain paused; resizing alone never opens this overlay.
      this.state.beforePause = "arming";
      this.state.phase = "paused";
      this.state.pauseRequested = false;
      this.actions.drawPause();
      return;
    }
    this.state.phase = "arming";
    const generation = this.state.viewGeneration;
    this.scene.game.events.once("postrender", () => {
      if (this.state.phase === "arming" && generation === this.state.viewGeneration) {
        if (this.state.pauseRequested || (this.actions.timeLimited() && document.hidden)) {
          this.state.pauseRequested = false;
          this.pause();
          return;
        }
        this.settle("play", progress.elapsed);
      }
    });
  }
}
