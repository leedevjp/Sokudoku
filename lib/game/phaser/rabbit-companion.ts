import { paintHearts } from "./reward-effects";
import Phaser from "phaser";
import { petFrame, type PetMotion } from "../pet-motion";
const TEXTURE = "battle-mage-v5";
export function preloadRabbit(scene: Phaser.Scene) {
  if (!scene.textures.exists(TEXTURE))
    scene.load.image(TEXTURE, "/battle/mage-v5.png");
}
/** The same low-resolution atlas supplies combat, results and pause poses. */
export class RabbitCompanion {
  readonly root: Phaser.GameObjects.Container;
  private hearts?: Phaser.GameObjects.Graphics;
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
    this.hearts = scene.add.graphics();
    this.root.add(this.hearts);
  }
  show(motion: PetMotion, elapsed: number, reduced: boolean) {
    this.sprite
      ?.setFrame(String(petFrame(motion, elapsed, reduced)))
      .setDisplaySize(this.size, this.size);
    if (this.hearts) {
      this.hearts.clear();
      if (motion === "happy" || motion === "celebrate")
        paintHearts(
          this.hearts,
          motion === "celebrate" ? elapsed % 1440 : elapsed,
          this.size,
          reduced,
        );
    }
  }
}
