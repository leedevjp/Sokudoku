import Phaser from "phaser";
import type { Result } from "../types";
import { petFrame } from "../pet-motion";
import {
  magicEncounter,
  magicCastFrame,
  magicFallFrame,
  magicImpactFrame,
  SPELL_HIT_MS,
  SPELL_HIT_STOP_MS,
} from "../magic-presentation";
import type { TrainingView } from "./board";

const MEADOW = "battle-meadow-original-v4";
const MAGE = "battle-mage-v5";
const MONSTERS = "battle-mandrakes-v5";
const MAGIC = "battle-magic-v5";
export function preloadBattle(scene: Phaser.Scene) {
  for (const [key, file] of [
    [MEADOW, "meadow-original-v4.png"],
    [MAGE, "mage-v5.png"],
    [MONSTERS, "mandrakes-v5.png"],
    [MAGIC, "magic-v5.png"],
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
  const width = source.width / columns,
    height = source.height / rows;
  for (let i = 0; i < columns * rows; i++) {
    if (!texture.has(String(i)))
      texture.add(
        String(i),
        0,
        (i % columns) * width,
        Math.floor(i / columns) * height,
        width,
        height,
      );
  }
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
/** Presentation only. The caster stays planted; spells carry the movement. */
export class MeadowBattle {
  private mage?: Phaser.GameObjects.Image;
  private monster?: Phaser.GameObjects.Image;
  private spell?: Phaser.GameObjects.Image;
  private elapsed = 0;
  private idleElapsed = 0;
  private result?: Result;
  private impact?: () => void;
  private impacted = false;
  private s: number;
  private startX: number;
  private enemyX: number;
  private baseline: number;
  private monsterRow: number;
  private element: number;
  constructor(scene: Phaser.Scene, view: TrainingView, encounterKey: string) {
    const { scale: s, left, width, top, extra } = view.boardLayout;
    this.s = s;
    const y = top + 466 * s + extra;
    this.startX = left + 100 * s;
    this.enemyX = left + width * 0.62;
    this.baseline = y + 140 * s;
    const encounter = magicEncounter(encounterKey);
    this.monsterRow = encounter.monster * 6;
    this.element = encounter.element * 6;
    if (scene.textures.exists(MEADOW)) {
      scene.textures.get(MEADOW).setFilter(Phaser.Textures.FilterMode.NEAREST);
      scene.add
        .image(left, y, MEADOW)
        .setOrigin(0)
        .setDisplaySize(width, 166 * s);
      scene.add
        .rectangle(left + width / 2, y + 83 * s, width, 166 * s)
        .setStrokeStyle(Math.max(1, s), 0xacc8af, 0.6);
    }
    if (scene.textures.exists(MAGE)) {
      frames(scene, MAGE, 4, 5);
      this.mage = scene.add
        .image(this.startX, this.baseline, MAGE, "0")
        .setOrigin(0.5, 0.88)
        .setDisplaySize(154 * s, 154 * s)
        .setFlipX(true);
    }
    if (scene.textures.exists(MONSTERS)) {
      frames(scene, MONSTERS, 6, 4);
      this.monster = scene.add
        .image(this.enemyX, this.baseline, MONSTERS, String(this.monsterRow))
        .setOrigin(0.5, 0.88)
        .setDisplaySize(112 * s, 112 * s);
    }
    if (scene.textures.exists(MAGIC)) {
      frames(scene, MAGIC, 6, 4);
      this.spell = scene.add
        .image(this.startX, this.baseline, MAGIC, String(this.element))
        .setDisplaySize(160 * s, 160 * s)
        .setVisible(false);
    }
  }
  attack(result: Result, reduced: boolean, impact: () => void) {
    this.result = result;
    this.elapsed = 0;
    this.impact = impact;
    if (reduced || result === "timeout" || !this.mage || !this.monster)
      this.land();
  }
  private land() {
    if (this.impacted) return;
    this.impacted = true;
    const callback = this.impact;
    this.impact = undefined;
    callback?.();
  }
  private effect(frame: number, x: number, y: number, size = 160) {
    this.spell
      ?.setFrame(String(this.element + frame))
      .setPosition(x, y)
      .setDisplaySize(size * this.s, size * this.s)
      .setVisible(true);
  }
  update(delta: number, paused: boolean, reduced: boolean) {
    if (paused) return;
    this.idleElapsed += Math.max(0, delta);
    this.spell?.setVisible(false);
    if (!this.result) {
      this.mage?.setFrame(String(petFrame("idle", this.idleElapsed, reduced)));
      this.monster?.setFrame(
        String(
          this.monsterRow +
            (reduced ? 0 : Math.floor(this.idleElapsed / 460) % 2),
        ),
      );
      return;
    }
    this.elapsed += Math.max(0, delta);
    const t = this.elapsed;
    if (reduced || this.result === "timeout") {
      this.mage?.setFrame(this.result === "correct" ? "16" : "15");
      this.monster?.setVisible(this.result !== "correct");
      this.land();
      return;
    }
    const handX = this.startX + 36 * this.s;
    const spellY = this.baseline - 46 * this.s;
    this.mage?.setFrame(String(magicCastFrame(t)));
    if (t < SPELL_HIT_MS) {
      const progress = Math.max(0, (t - 60) / (SPELL_HIT_MS - 60));
      this.effect(
        t < 60 ? 0 : 1,
        handX + (this.enemyX - handX) * progress * progress,
        spellY,
        t < 60 ? 90 : 140,
      );
      return;
    }
    if (this.result === "incorrect") {
      this.mage?.setFrame(String(magicFallFrame(t)));
      this.monster?.setFrame(
        String(
          this.monsterRow +
            (t < 450 ? 2 : Math.floor(this.idleElapsed / 460) % 2),
        ),
      );
      // The failed spell dissipates before contact; no hit flash or enemy damage.
      if (t < 290)
        this.effect(t < 220 ? 4 : 5, this.enemyX - 60 * this.s, spellY, 90);
      if (t >= 300) this.land();
      return;
    }
    const age = t - SPELL_HIT_MS;
    const push =
      1 -
      Math.pow(
        1 - Math.max(0, Math.min(1, (age - SPELL_HIT_STOP_MS) / 160)),
        3,
      );
    this.monster
      ?.setFrame(
        String(
          this.monsterRow + (age < SPELL_HIT_STOP_MS ? 3 : age < 140 ? 4 : 5),
        ),
      )
      .setPosition(
        this.enemyX + 65 * push * this.s,
        this.baseline - 18 * Math.sin(push * Math.PI) * this.s,
      )
      .setAlpha(Math.max(0, 1 - Math.max(0, age - 200) / 110));
    const frame = magicImpactFrame(age);
    if (frame !== null) this.effect(frame, this.enemyX, spellY);
    this.land();
  }
}
