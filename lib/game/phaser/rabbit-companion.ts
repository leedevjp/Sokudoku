import Phaser from "phaser";
import { petFrame, type PetMotion } from "../pet-motion";
const TEXTURE = "sokudoku-rabbit-v1";
export function preloadRabbit(scene: Phaser.Scene) {
  if (!scene.textures.exists(TEXTURE))
    scene.load.image(TEXTURE, "/pets/rabbit-v1.png");
}
/** The generated poses live in sixteen equal cells; runtime slicing preserves the source. */
export class RabbitCompanion {
  readonly root: Phaser.GameObjects.Container;
  private sprite?: Phaser.GameObjects.Image;
  private maskShape?: Phaser.GameObjects.Graphics;
  private mask?: Phaser.Display.Masks.GeometryMask;
  constructor(scene: Phaser.Scene, x: number, y: number, size: number) {
    this.root = scene.add.container(x, y);
    if (!scene.textures.exists(TEXTURE)) return; // Art failure must not block learning.
    const texture = scene.textures.get(TEXTURE);
    const source = texture.getSourceImage() as HTMLImageElement;
    for (let i = 0; i < 16; i++) {
      if (texture.has(String(i))) continue;
      const col = i % 4,
        row = Math.floor(i / 4);
      const left = Math.round((col * source.width) / 4),
        top = Math.round((row * source.height) / 4);
      texture.add(
        String(i),
        0,
        left,
        top,
        Math.round(((col + 1) * source.width) / 4) - left,
        Math.round(((row + 1) * source.height) / 4) - top,
      );
    }
    this.root.add(scene.add.circle(0, 3, size / 2, 0x76628a, 0.12));
    this.root.add(scene.add.circle(0, 0, size / 2, 0xfffcf8));
    this.sprite = scene.add
      .image(0, 0, TEXTURE, "0")
      .setDisplaySize(size, size);
    this.maskShape = scene.make.graphics({ x: 0, y: 0 });
    this.maskShape.fillStyle(0xffffff).fillCircle(x, y, size / 2);
    this.mask = this.maskShape.createGeometryMask();
    this.sprite.setMask(this.mask);
    this.root.add(this.sprite);
    this.root.add(
      scene.add.circle(0, 0, size / 2).setStrokeStyle(1, 0xb6a3c4, 0.35),
    );
    this.root.once("destroy", () => {
      this.sprite?.clearMask();
      this.mask?.destroy();
      this.maskShape?.destroy();
    });
  }
  show(motion: PetMotion, elapsed: number, reduced: boolean) {
    this.sprite?.setFrame(String(petFrame(motion, elapsed, reduced)));
  }
}
