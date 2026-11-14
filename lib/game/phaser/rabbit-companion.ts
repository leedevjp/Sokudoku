import { EmotionEffect, preloadEmotions } from "./emotion-effects";
import Phaser from "phaser";
import { gameAssetUrl } from "../asset-url";
import { petFrame, type PetMotion } from "../pet-motion";
const TEXTURE = "battle-mage-v5";
export function preloadRabbit(scene: Phaser.Scene) {
  preloadEmotions(scene);
  if (!scene.textures.exists(TEXTURE))
    scene.load.image(TEXTURE, gameAssetUrl("/battle/mage-v5.webp"));
}
/** The same low-resolution atlas supplies combat, results and pause poses. */
export class RabbitCompanion {
  readonly root: Phaser.GameObjects.Container;
  private emotion?: EmotionEffect;
  private sprite?: Phaser.GameObjects.Image;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private size: number,
  ) {
    this.root = scene.add.container(x, y);
    if (!scene.textures.exists(TEXTURE)) return;
    const texture = scene.textures.get(TEXTURE);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (let i = 0; i < 20; i++)
      if (!texture.has(String(i)))
        texture.add(
          String(i),
          0,
          (i % 4) * 128,
          Math.floor(i / 4) * 128,
          128,
          128,
        );
    this.sprite = scene.add
      .image(0, 0, TEXTURE, "0")
      .setDisplaySize(size, size);
    this.root.add(this.sprite);
    this.emotion = new EmotionEffect(scene);
    if (this.emotion.sprite) this.root.add(this.emotion.sprite);
  }
  show(motion: PetMotion, elapsed: number, reduced: boolean) {
    this.sprite
      ?.setFrame(String(petFrame(motion, elapsed, reduced)))
      .setDisplaySize(this.size, this.size);
    this.emotion?.hide();
    if (motion === "happy" || motion === "celebrate" || motion === "encourage") {
      this.emotion?.show(
        motion === "encourage" ? "confusion" : "hearts",
        elapsed, reduced, this.size * 0.29, -this.size * 0.31, this.size * 0.36,
      );
    }
  }
}
