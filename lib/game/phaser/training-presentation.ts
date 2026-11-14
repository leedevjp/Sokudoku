import type Phaser from "phaser";
import { MeadowBattle } from "./meadow-battle";
import { RabbitCompanion } from "./rabbit-companion";
import { SceneMedia } from "./scene-media";
import { battleReady } from "./presentation-assets";
import { PetMotionState } from "../pet-motion";
import type { TrainingSession } from "../session";
import type { BattleProgress } from "../battle-progress";
import type { TrainingOptions } from "./types";
import type { TrainingState } from "./training-state";
import type { Preferences } from "../preferences";
import type { ResultData, ResultActions } from "./result-overlay";
import { drawPause } from "./pause-overlay";
import { drawTrainingResult } from "./result-presentation";
import { TrainingView } from "./board";
import { BattleAudio } from "./battle-audio";

type PresentationActions = {
  pause: () => void;
  resume: () => void;
  press: (source: string, index: number) => void;
  toggleSound: () => void;
  finish: (reviewComplete: boolean, exitAfterSave: boolean) => void;
  showResult: () => void;
  clearCorrectionView: () => void;
};

/** Owns display/media lifetimes; no question selection, grading or persistence. */
export class TrainingPresentation {
  readonly view: TrainingView;
  readonly petMotion = new PetMotionState();
  preferences: Preferences;
  audio?: BattleAudio;
  battle?: MeadowBattle;
  private pet?: RabbitCompanion;
  private reducedMotion?: MediaQueryList;
  private media?: SceneMedia;
  private soundExpanded = false;
  private overlay?: Phaser.GameObjects.Container;
  private failed = false;
  private readyNotified = false;

  constructor(
    private scene: Phaser.Scene,
    private options: TrainingOptions,
    private state: TrainingState,
    private session: TrainingSession,
    private battleProgress: BattleProgress,
    private density: number,
    private actions: PresentationActions,
  ) {
    this.preferences = options.preferences;
    this.view = new TrainingView(scene, () => this.density, () => this.preferences, {
      pause: actions.pause,
      toggleSound: actions.toggleSound,
      soundEnabled: () => this.audio?.enabled ?? false,
      press: actions.press,
    });
  }
  get timeLimited() { return this.options.timeLimited !== false; }
  get motionReduced() { return this.reducedMotion?.matches ?? false; }
  markFailed() { this.failed = true; }
  closePause() { this.overlay?.destroy(); this.overlay = undefined; }
  initializeViewport() {
    this.syncCamera();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.scene.game.canvas.setAttribute(
      "aria-label",
      this.view.t(
        "単語トレーニング。数字1〜4を押した瞬間に回答。Escapeで一時停止。",
        "단어 훈련. 숫자 1~4를 누르는 순간 답하기. Escape로 일시정지.",
      ),
    );
    this.scene.game.canvas.setAttribute("tabindex", "0");
  }
  initializeMedia() {
    this.audio = new BattleAudio(this.scene);
    this.media = new SceneMedia(this.scene, () => this.attachBattleWhenReady());
  }
  startMedia() { this.media?.start(); }
  closeMedia() { this.media?.close(); }
  setRenderDensity(value: number) {
    this.density = value;
  }
  syncCamera() {
    // World units remain CSS pixels; only the framebuffer and camera are high-DPI.
    this.scene.cameras.main
      .setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(this.density)
      .centerOn(this.view.w / 2, this.view.h / 2);
  }
  clear() {
    this.pet = undefined;
    this.battle = undefined;
    this.state.viewGeneration++;
    this.scene.children.removeAll(true);
    this.view.clear();
    this.actions.clearCorrectionView();
    this.overlay = undefined;
    this.scene.cameras.main.setBackgroundColor(this.view.c.bg);
    this.view.backdrop();
  }
  private redrawStatic() {
    if (this.state.phase === "end") this.actions.showResult();
    else if (this.state.phase === "paused") {
      this.scene.cameras.main.setBackgroundColor(this.view.c.bg);
      this.drawPause();
    }
  }
  drawBoard() {
    this.clear();
    this.view.drawBoard(this.state.question, this.session.hearts, this.session.correct, this.state.maxTime, this.timeLimited);
    this.attachBattleWhenReady();
    this.notifyReady();
  }
  private attachBattleWhenReady() {
    // The quiz is intentionally shown before its artwork loads. Attach the
    // actors to the already visible question once every battle texture exists,
    // without rebuilding the board, resetting input or restarting the timer.
    if (!battleReady(key => this.scene.textures.exists(key))) return;
    if (this.state.preparingQuestion || !this.state.question || this.battle ||
        !["arming", "play", "settling"].includes(this.state.phase)) return;
    this.battle = new MeadowBattle(this.scene, this.view, this.state.question.word.id, this.session.correct, this.battleProgress.combo);
  }
  private notifyReady() {
    if (this.readyNotified) return;
    this.readyNotified = true;
    this.scene.game.events.once("postrender", () => { if (!this.failed) this.options.onReady?.(); });
  }
  paintPet() {
    this.pet?.show(
      this.petMotion.motion,
      this.petMotion.elapsed,
      this.reducedMotion?.matches ?? false,
    );
  }
  drawPause() {
    this.overlay?.destroy();
    this.overlay = drawPause(this.view, {
      resume: () => this.actions.resume(),
      finish: () => {
        // DOM controls live outside the Phaser display list. Dispose them first
        // so a saving/result screen can never remain hidden behind the pause UI.
        this.overlay?.destroy();
        this.overlay = undefined;
        this.scene.time.paused = false;
        this.scene.tweens.resumeAll();
        this.actions.finish(false, true);
      },
      preferences: this.preferences,
      audio: this.audio,
      toggleSound: () => this.actions.toggleSound(),
      soundExpanded: this.soundExpanded,
      setSoundExpanded: (expanded) => { this.soundExpanded = expanded; },
      changePreferences: (preferences) => {
        this.preferences = preferences;
        this.options.onPreferences(preferences);
        this.redrawStatic();
      },
    });
  }
  update(delta: number) {
    this.audio?.update(!["paused", "end"].includes(this.state.phase), delta);
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
  }
  drawResult(data: () => ResultData, actions: ResultActions) {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.scene.tweens.killAll();
    this.notifyReady();
    this.clear();
    this.pet = drawTrainingResult(
      this.scene, this.view, this.session.correct,
      data(), actions,
    );
    this.paintPet();
  }
}
