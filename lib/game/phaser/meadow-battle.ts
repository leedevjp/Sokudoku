import Phaser from "phaser";
import type { Result } from "../types";
import { petFrame } from "../pet-motion";
import {
  CHARGE_MS,
  HIT_STOP_MS,
  chargeProgress,
  knockbackProgress,
  dodgePose,
  stumblePose,
} from "../battle-timing";
import { paintContact, paintSpeed } from "./battle-impact";
import type { TrainingView } from "./board";

const MEADOW = "battle-meadow-original-v4";
const RABBIT = "battle-hero-original-v4";
const ACTIONS = RABBIT;
const SLIME_ACTIONS = "battle-sprout-original-v4";
const SLIME = "battle-sprout-original-v4";
export function preloadBattle(scene: Phaser.Scene) {
  for (const [key, file] of [
    [MEADOW, "meadow-original-v4.png"],
    [RABBIT, "hero-original-v4.png"],
    [SLIME, "sprout-original-v4.png"],
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
    this.enemyX = left + width * 0.62;
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
      frames(scene, RABBIT, 6, 6);
      this.rabbit = scene.add
        .image(this.startX, this.baseline, RABBIT, "0")
        .setOrigin(0.5, 0.88)
        .setDisplaySize(142 * s, 142 * s)
        .setFlipX(false);
    }
    if (scene.textures.exists(SLIME)) {
      frames(scene, SLIME, 4, 4);
      this.slime = scene.add
        .image(this.enemyX, this.baseline, SLIME, "0")
        .setOrigin(0.5, 0.88)
        .setDisplaySize(128 * s, 128 * s)
        .setFlipX(false);
    }
    for (const key of [MEADOW, RABBIT, SLIME]) {
      if (scene.textures.exists(key))
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.effects = scene.add.graphics();
  }
  attack(result: Result, reduced: boolean, impact: () => void) {
    this.result = result;
    this.elapsed = 0;
    this.impact = impact;
    if (reduced || result === "timeout" || !this.rabbit || !this.slime) {
      this.land();
    }
  }

  private land() {
    if (this.impacted) return;
    this.impacted = true;
    const callback = this.impact;
    this.impact = undefined;
    callback?.();
  }
  private pose(rabbit: boolean, frame: number) {
    const sprite = rabbit ? this.rabbit : this.slime;
    const texture = rabbit ? ACTIONS : SLIME_ACTIONS;
    if (sprite?.scene.textures.exists(texture))
      sprite
        .setTexture(texture, String(rabbit ? frame : frame + 8))
        .setFlipX(false);
    else sprite?.setFrame(rabbit ? "0" : "0");
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
        .setDisplaySize(128 * this.s, 128 * this.s);
      return;
    }
    this.elapsed += Math.max(0, delta);
    const t = this.elapsed;
    const contactX = this.enemyX - 66 * this.s;
    if (reduced || this.result === "timeout") {
      this.pose(true, this.result === "correct" ? 16 : 29);
      this.slime?.setVisible(this.result !== "correct");
    } else {
      if (t < CHARGE_MS) {
        const progress = chargeProgress(t);
        this.rabbit?.setX(this.startX + (contactX - this.startX) * progress);
        this.pose(true, t < 25 ? 12 : t < 65 ? 13 : t < 120 ? 14 : 15);
        paintSpeed(
          this.effects,
          this.rabbit?.x ?? this.startX,
          this.baseline,
          this.s,
          progress,
        );
      }
      if (this.result === "incorrect") {
        const dodge = dodgePose(t);
        this.pose(false, dodge.frame);
        this.slime?.setPosition(
          this.enemyX + dodge.x * this.s,
          this.baseline + dodge.y * this.s,
        );
        if (t >= CHARGE_MS) {
          const stumble = stumblePose(t);
          this.pose(
            true,
            t < 210
              ? 18
              : t < 250
                ? 19
                : t < 300
                  ? 20
                  : t < 450
                    ? 21
                    : t < 650
                      ? 22
                      : t < 800
                        ? 23
                        : t < 950
                          ? 24
                          : t < 1100
                            ? 25
                            : t < 1250
                              ? 26
                              : t < 1400
                                ? 27
                                : 29,
          );
          this.rabbit?.setX(contactX + stumble.x * this.s);
          if (t >= 280 && t < 500) {
            const fade = 1 - (t - 280) / 220;
            for (let i = 0; i < 5; i++)
              this.effects
                .fillStyle(0xe5cc99, fade * 0.8)
                .fillRect(
                  (this.rabbit?.x ?? contactX) + (i - 3) * 14 * this.s,
                  this.baseline - 6 * this.s,
                  (14 + i * 2) * this.s,
                  7 * this.s,
                );
          }
        }
        // Start correction once the fall is visibly underway, without delaying reading until recovery.
        if (t >= 300) this.land();
      } else if (t >= CHARGE_MS) {
        const age = t - CHARGE_MS;
        const push = knockbackProgress(age);
        this.pose(true, age < HIT_STOP_MS ? 16 : 17);
        this.rabbit?.setX(contactX + 18 * push * this.s);
        this.pose(
          false,
          age < HIT_STOP_MS ? 4 : age < 130 ? 5 : age < 230 ? 6 : 7,
        );
        this.slime
          ?.setPosition(
            this.enemyX + 142 * push * this.s,
            this.baseline - 48 * Math.sin(push * Math.PI * 0.8) * this.s,
          )
          .setAlpha(Math.max(0, 1 - Math.max(0, age - 210) / 110));
        this.effects
          .clear()
          .setPosition(this.enemyX - 24 * this.s, this.baseline - 57 * this.s);
        paintContact(this.effects, age, this.s * 1.45);
        this.land();
      }
    }
    this.rabbit?.setDisplaySize(142 * this.s, 142 * this.s);
    this.slime?.setDisplaySize(128 * this.s, 128 * this.s);
  }
}
