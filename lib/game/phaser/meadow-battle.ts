import { EmotionEffect, preloadEmotions } from "./emotion-effects";
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
import { battleRegion, comboTier, idleBattlePose } from "../battle-progress";

const MEADOW = "battle-meadow-original-v4";
const MAGE = "battle-mage-v5";
const MONSTERS = "battle-mandrakes-v5";
const MAGIC = "battle-magic-v5";
const REGIONS = [MEADOW, "battle-forest-v1", "battle-moon-ruins-v1"];
const COMBO = "battle-combo-burst-v1";
export function preloadBattle(scene: Phaser.Scene) {
  preloadEmotions(scene);
  for (const [key, file] of [
    [MEADOW, "meadow-original-v4.png"],
    [MAGE, "mage-v5.png"],
    [MONSTERS, "mandrakes-v5.png"],
    [MAGIC, "magic-v5.png"],
    [REGIONS[1], "forest-v1.png"],
    [REGIONS[2], "moon-ruins-v1.png"],
    [COMBO, "combo-burst-v1.png"],
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
/** Presentation only: actors move inside the arena without affecting answer time. */
export class MeadowBattle {
  private mageEmotion?: EmotionEffect;
  private monsterEmotion?: EmotionEffect;
  private mage?: Phaser.GameObjects.Image;
  private monster?: Phaser.GameObjects.Image;
  private spell?: Phaser.GameObjects.Image;
  private comboEffect?: Phaser.GameObjects.Image;
  private comboText?: Phaser.GameObjects.Text;
  private combo = 0;
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
  constructor(scene: Phaser.Scene, view: TrainingView, encounterKey: string, correct = 0, combo = 0) {
    const { scale: s, left, width, top, extra } = view.boardLayout;
    this.s = s;
    const y = top + 466 * s + extra;
    this.startX = left + 100 * s;
    this.enemyX = left + width * 0.62;
    this.baseline = y + 140 * s;
    const encounter = magicEncounter(encounterKey);
    this.monsterRow = encounter.monster * 6;
    this.element = encounter.element * 6;
    this.combo = combo;
    const region = battleRegion(correct), map = REGIONS[region];
    if (scene.textures.exists(map)) {
      scene.textures.get(map).setFilter(Phaser.Textures.FilterMode.NEAREST);
      scene.add
        .image(left, y, map)
        .setOrigin(0)
        .setDisplaySize(width, 166 * s);
      scene.add
        .rectangle(left + width / 2, y + 83 * s, width, 166 * s)
        .setStrokeStyle(Math.max(1, s), 0xacc8af, 0.6);
    }
    view.designText(left + width - 8 * s, y + 12 * s,
      view.t(["草原", "木漏れ日の森", "月の遺跡"][region], ["초원", "햇살 숲", "달빛 유적"][region]) + ` · ${correct % 10}/10`,
      12 * s, region === 2 ? 0xffffff : 0x254d48, true).setOrigin(1, .5);
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
    if (scene.textures.exists(COMBO)) {
      frames(scene, COMBO, 4, 3);
      this.comboEffect = scene.add.image(this.enemyX, this.baseline - 46 * s, COMBO, "0")
        .setDisplaySize(112 * s, 112 * s).setVisible(false);
    }
    this.comboText = view.designText(left + width * .45, y + 20 * s,
      combo >= 2 ? `${combo} COMBO` : "", 16 * s, 0xffffff, true)
      .setStroke("#284267", Math.max(2, 3 * s));
    this.mageEmotion = new EmotionEffect(scene);
    this.monsterEmotion = new EmotionEffect(scene);
  }
  attack(result: Result, reduced: boolean, impact: () => void, combo = 0) {
    this.result = result;
    this.combo = combo;
    this.comboText?.setText(combo >= 2 ? `${combo} COMBO` : "")
      .setColor(combo >= 10 ? "#ffe196" : combo >= 5 ? "#e7c4ff" : "#ffffff");
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
    this.comboEffect?.setVisible(false);
    this.mageEmotion?.hide();
    this.monsterEmotion?.hide();
    if (!this.result) {
      const pose = idleBattlePose(this.idleElapsed, reduced);
      this.mage?.setPosition(this.startX + pose.mageX * this.s, this.baseline + pose.mageY * this.s);
      this.monster?.setPosition(this.enemyX + pose.monsterX * this.s, this.baseline + pose.monsterY * this.s);
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
    // Head-side accents stay inside the meadow and clear of faces and spell impact.
    if (this.result === "timeout" || (this.result === "incorrect" && t >= SPELL_HIT_MS)) {
      const age = this.result === "timeout" ? t : t - SPELL_HIT_MS;
      this.mageEmotion?.show("confusion", age, reduced,
        this.startX - 40 * this.s, this.baseline - 99 * this.s, 48 * this.s);
      if (this.result === "incorrect") this.monsterEmotion?.show("anger", age, reduced,
        this.enemyX + 40 * this.s, this.baseline - 85 * this.s, 40 * this.s);
    } else if (this.result === "correct" && (reduced || t >= SPELL_HIT_MS)) {
      this.mageEmotion?.show("hearts", Math.max(0, t - SPELL_HIT_MS), reduced,
        this.startX - 40 * this.s, this.baseline - 99 * this.s, 52 * this.s);
    }
    if (reduced || this.result === "timeout") {
      this.mage?.setFrame(this.result === "correct" ? "16" : "15");
      this.monster?.setVisible(this.result !== "correct");
      this.land();
      return;
    }
    const handX = this.startX + 36 * this.s;
    const spellY = this.baseline - 46 * this.s;
    this.mage?.setFrame(String(magicCastFrame(t)));
    // A short step into the cast, then recoil. The wrong-answer fall slides back.
    const step = t < SPELL_HIT_MS ? Math.sin(t / SPELL_HIT_MS * Math.PI / 2) * 12
      : this.result === "correct" ? 12 * Math.max(0, 1 - (t - SPELL_HIT_MS) / 200)
      : -12 * Math.min(1, (t - SPELL_HIT_MS) / 180);
    this.mage?.setPosition(this.startX + step * this.s, this.baseline);
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
      const dodge = Math.sin(Math.min(1, (t - SPELL_HIT_MS) / 300) * Math.PI);
      this.monster?.setPosition(this.enemyX + 18 * dodge * this.s, this.baseline - 22 * dodge * this.s);
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
    const tier = comboTier(this.combo);
    if (tier && age < 280) this.comboEffect?.setFrame(String((tier - 1) * 4 + Math.min(3, Math.floor(age / 70))))
      .setDisplaySize((92 + tier * 12) * this.s, (92 + tier * 12) * this.s).setVisible(true);
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
