import { RabbitCompanion } from "./rabbit-companion";
import Phaser from "phaser";
import { choiceLabel, INITIAL_HEARTS } from "../rules";
import type { Question } from "../types";
import type { Preferences } from "../preferences";
import { TrainingSurface } from "./surface";
import { drawHud, drawInputHint } from "./board-hud";
import {
  drawChoices,
  paintChoice as paintChoiceBackground,
} from "./board-choices";
import { drawQuestionCard } from "./board-cards";

type BoardActions = {
  pause: () => void;
  toggleSound: () => void;
  soundEnabled: () => boolean;
  press: (source: string, index: number) => void;
};

/** Owns display objects; game rules and lifecycle remain in TrainingScene. */
export class TrainingView extends TrainingSurface {
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
  private hearts = INITIAL_HEARTS;
  constructor(
    scene: Phaser.Scene,
    getDensity: () => number,
    getPreferences: () => Preferences,
    private actions: BoardActions,
  ) {
    super(scene, getDensity, getPreferences);
  }
  createRestingRabbit(x: number, y: number, size: number) {
    const pet = new RabbitCompanion(this.scene, x, y, size);
    pet.show("rest", 0, true);
    return pet;
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
  paintChoice(
    c: Phaser.GameObjects.Container,
    pressed = false,
    correct = false,
  ) {
    paintChoiceBackground(
      this,
      this.choiceBackgrounds.get(c)!,
      c,
      pressed,
      correct,
    );
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
  drawBoard(
    question: Question,
    hearts: number,
    correct: number,
    maxTime: number,
    timeLimited = true,
  ) {
    this.hearts = hearts;
    this.timeBar = drawHud(this, correct, maxTime, () => this.actions.pause(), this.actions.toggleSound, this.actions.soundEnabled, timeLimited);
    this.drawHearts();
    drawQuestionCard(this, question);
    const choices = drawChoices(this, question, (source, index) =>
      this.actions.press(source, index),
    );
    this.choices = choices.choices;
    this.choiceBackgrounds = choices.backgrounds;
    this.choiceLabels = choices.labels;
    this.game.canvas.setAttribute(
      "aria-label",
      [
        this.t("問題", "문제"),
        question.word.term,
        question.kind,
        ...question.options.map(
          (w, i) => String(i + 1) + ": " + choiceLabel(w, question.kind),
        ),
        this.t("ライフ", "하트") + this.hearts,
      ].join(" / "),
    );
    drawInputHint(this);
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
