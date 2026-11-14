import type Phaser from "phaser";
import { Correction } from "../correction";
import type { PetMotionState } from "../pet-motion";
import { comboTier, type BattleProgress } from "../battle-progress";
import type { AnswerGate } from "../rules";
import type { TrainingSession } from "../session";
import type { Preferences } from "../preferences";
import type { BattleAudio } from "./battle-audio";
import type { MeadowBattle } from "./meadow-battle";
import type { TrainingOptions } from "./types";
import type { TrainingState } from "./training-state";
import type { TrainingView } from "./board";
import type { TrainingFeedback } from "./training-feedback";
import type { CorrectionCard } from "./correction-card";
import { paintAnswerFeedback } from "./answer-feedback";
import { showCorrection } from "./correction-presentation";
import { answerImpact, burst } from "./effects";

type AnswerActions = {
  options: () => TrainingOptions;
  preferences: () => Preferences;
  audio: () => BattleAudio | undefined;
  battle: () => MeadowBattle | undefined;
  reducedMotion: () => boolean;
  paintPet: () => void;
};

/** Records each answer once, then presents impact, speech and optional correction. */
export class TrainingAnswers {
  private correction?: Correction;
  private correctionView?: CorrectionCard;

  constructor(
    private scene: Phaser.Scene,
    private state: TrainingState,
    private session: TrainingSession,
    private gate: AnswerGate,
    private view: TrainingView,
    private feedback: TrainingFeedback,
    private petMotion: PetMotionState,
    private battleProgress: BattleProgress,
    private actions: AnswerActions,
  ) {}

  timeout() { this.resolve(null); }
  get correcting() { return !!this.correction; }
  reset() { this.correction = undefined; }
  clearView() { this.correctionView = undefined; }
  update(delta: number) {
    if (!this.correction) return;
    const expired = this.correction.tick(delta);
    this.correctionView?.update(this.correction);
    if (expired) this.finishCorrection();
  }
  press(source: string, i: number) {
    if (this.state.phase !== "play" || !this.gate.claim(source, i)) return;
    const card = this.view.choices[i];
    card.setScale(1.04);
    this.view.paintChoice(card, true);
    // Commit on down; the projectile is visual feedback, not part of response time.
    this.resolve(i);
  }
  cancelPress = () => {
    const i = this.gate.index;
    this.gate.cancel();
    if (i !== null && this.view.choices[i]) {
      const c = this.view.choices[i];
      this.scene.tweens.killTweensOf(c);
      c.setScale(1);
      this.view.paintChoice(c);
    }
  };
  private resolve(index: number | null) {
    if (this.state.phase !== "play") return;
    const rawElapsed = Math.max(0, performance.now() - this.state.started);
    const timeout = index === null || (this.actions.options().timeLimited !== false && rawElapsed >= this.state.maxTime);
    this.gate.close();
    this.state.phase = timeout ? "feedback" : "flight";
    const { answer: a, stats } = this.session.record(
      this.state.question,
      index,
      rawElapsed,
      this.state.maxTime,
      this.actions.options().stats,
      this.actions.options().timeLimited === false,
    );
    this.actions.options().stats = stats;
    this.actions.options().planner.record(a, this.state.question.word);
    // The displayed question remains valid even when a catalog refresh
    // replaces the runtime's word map before this answer is recorded.
    this.actions.options().onAnswer({ ...a, source: this.state.question.word.source === "personal" ? "personal" : "word" });
    const result = a.result;
    this.battleProgress.record(result);
    const tier = comboTier(this.battleProgress.combo);
    this.actions.audio()?.play(result === "timeout" ? "jelly" : "dash", result === "timeout" ? .10 : .12);
    this.correction =
      result === "correct" && this.actions.preferences().correctAnswerReview !== "card"
        ? undefined
        : new Correction(this.state.question);
    const hit = () => {
      if (result === "correct") this.actions.audio()?.impact(tier);
      else if (result === "incorrect") this.actions.audio()?.play("jelly", .12);
      this.state.phase = "feedback";
      paintAnswerFeedback(this.view, a, this.session.hearts, this.session.correct);
      this.feedback.speak(this.state.question.word, result, this.actions.preferences(), this.actions.audio()?.enabled ?? false);
      this.petMotion.play(result === "correct" ? "happy" : "encourage");
      this.actions.paintPet();
      if (this.correction) {
        this.state.phase = "correction";
        this.renderCorrection(true);
        return;
      }
      this.feedback.queue();
    };
    const impact = () =>
      answerImpact(this.scene, this.view, index, result, hit, false);
    const battle = this.actions.battle();
    if (battle)
      battle.attack(result, this.actions.reducedMotion(), impact, this.battleProgress.combo);
    else impact();
  }

  renderCorrection(animate = false) {
    const correction = this.correction;
    if (!correction) return;
    const lastResult = this.session.answers.at(-1)?.result;
    this.petMotion.play(lastResult === "correct" ? "happy" : "encourage");
    this.actions.paintPet();
    this.correctionView = showCorrection(
      this.scene,
      this.view,
      correction,
      this.session.answers.at(-1),
      this.state.maxTime,
      {
        advance: () => this.finishCorrection(),
        toggle: () => this.toggleCorrection(),
        enabled: () => this.state.phase === "correction",
      },
      animate,
    );
  }
  toggleCorrection() {
    if (this.state.phase !== "correction" || !this.correction) return;
    this.correction.toggle();
    this.correctionView?.update(this.correction);
  }
  finishCorrection(index?: number) {
    if (this.state.phase !== "correction" || this.feedback.speaking || !this.correction?.complete(index))
      return;
    this.state.phase = "feedback";
    this.correction = undefined;
    this.petMotion.play("happy");
    const card = this.correctionView?.root;
    if (card) {
      burst(this.scene, card.x, card.y, this.view.c.blue);
      card.disableInteractive().setVisible(false);
    }
    this.feedback.queue();
  }
}
