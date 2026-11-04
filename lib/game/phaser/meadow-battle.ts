import Phaser from "phaser";
import type { Result } from "../types";
import { petFrame } from "../pet-motion";
import { paintHearts } from "./reward-effects";
import { burst } from "./effects";
import type { TrainingView } from "./board";

const MEADOW = "battle-meadow-v1";
const RABBIT = "battle-rabbit-v1";
const SLIME = "battle-slime-v1";
export function preloadBattle(scene: Phaser.Scene) {
  for (const [key, file] of [
    [MEADOW, "meadow-v1.webp"],
    [RABBIT, "rabbit-cutout-v1.webp"],
    [SLIME, "slime-v1.webp"],
  ]) {
    if (!scene.textures.exists(key)) scene.load.image(key, "/battle/" + file);
  }
}
function frames(
  scene: Phaser.Scene,
  key: string,
  columns: number,
  rows: number,
) {
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as HTMLImageElement;
  for (let i = 0; i < columns * rows; i++) {
    if (texture.has(String(i))) continue;
    const x = Math.round(((i % columns) * source.width) / columns);
    const y = Math.round((Math.floor(i / columns) * source.height) / rows);
    texture.add(
      String(i),
      0,
      x,
      y,
      Math.round((((i % columns) + 1) * source.width) / columns) - x,
      Math.round(((Math.floor(i / columns) + 1) * source.height) / rows) - y,
    );
  }
}
/** Presentation only: answer recording and FSRS remain owned by TrainingScene. */
export class MeadowBattle {
  private rabbit?: Phaser.GameObjects.Image;
  private slime?: Phaser.GameObjects.Image;
  private hearts: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private result?: Result;
  private impact?: () => void;
  private impacted = false;
  private idleElapsed = 0;
  private s: number;
  private startX: number;
  private enemyX: number;
  private baseline: number;
  constructor(
    private scene: Phaser.Scene,
    view: TrainingView,
  ) {
    const { scale: s, left, width, top, extra } = view.boardLayout;
    this.s = s;
    const y = top + 466 * s + extra;
    this.startX = left + 100 * s;
    this.enemyX = left + width - 115 * s;
    this.baseline = y + 140 * s;
    if (scene.textures.exists(MEADOW)) {
      scene.add
        .image(left, y, MEADOW)
        .setOrigin(0)
        .setDisplaySize(width, 166 * s);
      scene.add
        .rectangle(left + width / 2, y + 83 * s, width, 166 * s)
        .setStrokeStyle(Math.max(1, s), 0xacc8af, 0.6);
    }
    if (scene.textures.exists(RABBIT)) {
      frames(scene, RABBIT, 4, 4);
      this.rabbit = scene.add
        .image(this.startX, this.baseline, RABBIT, "0")
        .setOrigin(0.5, 0.88)
        .setDisplaySize(142 * s, 142 * s)
        .setFlipX(true);
    }
    if (scene.textures.exists(SLIME)) {
      frames(scene, SLIME, 4, 2);
      this.slime = scene.add
        .image(this.enemyX, this.baseline, SLIME, "0")
        .setOrigin(0.5, 0.88)
        .setDisplaySize(105 * s, 105 * s);
    }
    this.hearts = scene.add.graphics();
  }
  attack(result: Result, reduced: boolean, impact: () => void) {
    this.result = result;
    this.elapsed = 0;
    this.impact = impact;
    if (reduced || result === "timeout" || !this.rabbit || !this.slime) {
      this.land(reduced);
    }
  }
  private land(reduced: boolean) {
    if (this.impacted) return;
    this.impacted = true;
    if (this.result === "correct") {
      this.slime?.setVisible(!reduced).setFrame("4");
      if (!reduced)
        burst(this.scene, this.enemyX, this.baseline - 32 * this.s, 0xf29ab3);
    } else this.slime?.setFrame("2");
    const callback = this.impact;
    this.impact = undefined;
    callback?.();
  }
  update(delta: number, paused: boolean, reduced: boolean) {
    if (paused) return;
    this.idleElapsed += delta;
    if (!this.result) {
      this.rabbit
        ?.setFrame(String(petFrame("idle", this.idleElapsed, reduced)))
        .setDisplaySize(142 * this.s, 142 * this.s);
      return;
    }
    this.elapsed += delta;
    const t = this.elapsed;
    if (!this.impacted) {
      const progress = Math.min(1, t / 280);
      this.rabbit?.setX(
        this.startX + (this.enemyX - 72 * this.s - this.startX) * progress,
      );
      this.rabbit?.setFrame(
        String([4, 5, 6, 7][Math.min(3, Math.floor(t / 70))]),
      );
      if (this.result === "incorrect" && t >= 140) {
        this.slime
          ?.setFrame(t < 220 ? "2" : "3")
          .setX(this.enemyX + 35 * this.s);
      }
      if (t >= 280) this.land(reduced);
    } else {
      const reaction =
        this.result === "timeout" || reduced ? t : Math.max(0, t - 280);
      this.rabbit?.setFrame(
        String(
          petFrame(
            this.result === "correct" ? "happy" : "encourage",
            reaction,
            reduced,
          ),
        ),
      );
      if (this.result === "correct") {
        this.slime?.setFrame(
          String(
            reaction < 80 ? 4 : reaction < 150 ? 5 : reaction < 230 ? 6 : 7,
          ),
        );
        this.hearts.setPosition(
          this.rabbit?.x ?? this.startX,
          this.baseline - 70 * this.s,
        );
        paintHearts(this.hearts, reaction, 110 * this.s, reduced);
      }
    }
    this.rabbit?.setDisplaySize(142 * this.s, 142 * this.s);
    this.slime?.setDisplaySize(105 * this.s, 105 * this.s);
  }
}
