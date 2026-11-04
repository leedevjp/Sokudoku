import Phaser from "phaser";
import type { Result } from "../types";
import { petFrame } from "../pet-motion";
import {
  CHARGE_MS,
  HIT_STOP_MS,
  chargeProgress,
  knockbackProgress,
} from "../battle-timing";
import { paintContact, paintSpeed } from "./battle-impact";
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
  private effects: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private result?: Result;
  private impact?: () => void;
  private impacted = false;
  private idleElapsed = 0;
  private s: number;
  private startX: number;
  private enemyX: number;
  private baseline: number;
  constructor(scene: Phaser.Scene, view: TrainingView) {
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
        .setDisplaySize(105 * s, 105 * s)
        .setFlipX(true);
    }
    this.effects = scene.add.graphics();
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
    } else this.slime?.setFrame("2");
    const callback = this.impact;
    this.impact = undefined;
    callback?.();
  }

  update(delta: number, paused: boolean, reduced: boolean) {
    if (paused) return;
    this.effects.clear().setPosition(0, 0);
    this.idleElapsed += Math.max(0, delta);
    if (!this.result) {
      this.rabbit
        ?.setFrame(String(petFrame("hop", this.idleElapsed * 1.4, reduced)))
        .setDisplaySize(142 * this.s, 142 * this.s);
      this.slime
        ?.setFrame(
          String(
            reduced ? 0 : [0, 1, 2, 3][Math.floor(this.idleElapsed / 110) % 4],
          ),
        )
        .setDisplaySize(105 * this.s, 105 * this.s);
      return;
    }
    this.elapsed += Math.max(0, delta);
    const t = this.elapsed;
    if (!this.impacted) {
      const progress = chargeProgress(t);
      // The nose overlaps the slime silhouette at contact, rather than stopping short.
      const target = this.enemyX + 14 * this.s - 44 * this.s;
      this.rabbit?.setX(this.startX + (target - this.startX) * progress);
      this.rabbit?.setFrame(t < 20 ? "4" : "6");
      this.slime?.setX(this.enemyX + 14 * this.s * progress);
      if (this.result === "incorrect" && t >= 75) {
        this.slime
          ?.setFrame("3")
          .setX(this.enemyX + 62 * this.s * Math.min(1, (t - 75) / 85));
      }
      if (!reduced)
        paintSpeed(
          this.effects,
          this.rabbit?.x ?? this.startX,
          this.baseline,
          this.s,
          progress,
        );
      if (t >= CHARGE_MS) this.land(reduced);
    }
    if (this.impacted) {
      const reaction =
        this.result === "timeout" || reduced ? t : Math.max(0, t - CHARGE_MS);
      if (this.result === "correct") {
        const push = reduced ? 0 : knockbackProgress(reaction);
        this.rabbit?.setFrame(
          reduced
            ? "0"
            : reaction < HIT_STOP_MS
              ? "6"
              : String(petFrame("hop", reaction - HIT_STOP_MS, false)),
        );
        this.slime
          ?.setX(this.enemyX + (14 + 62 * push) * this.s)
          .setFrame(
            String(
              reaction < HIT_STOP_MS
                ? 4
                : reaction < 140
                  ? 5
                  : reaction < 210
                    ? 6
                    : 7,
            ),
          )
          .setAlpha(
            reduced ? 0 : Math.max(0, 1 - Math.max(0, reaction - 180) / 100),
          );
        if (!reduced) {
          this.effects
            .clear()
            .setPosition(
              this.enemyX - 12 * this.s,
              this.baseline - 36 * this.s,
            );
          paintContact(this.effects, reaction, this.s);
        }
      } else {
        this.rabbit?.setFrame(String(petFrame("encourage", reaction, reduced)));
      }
    }
    this.rabbit?.setDisplaySize(142 * this.s, 142 * this.s);
    this.slime?.setDisplaySize(105 * this.s, 105 * this.s);
  }
}
