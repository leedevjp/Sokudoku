import Phaser from "phaser";

export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
) {
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18;
    const piece = scene.add
      .rectangle(
        x,
        y,
        Phaser.Math.Between(5, 14),
        Phaser.Math.Between(5, 13),
        color,
      )
      .setDepth(20);
    scene.tweens.add({
      targets: piece,
      x: x + Math.cos(angle) * Phaser.Math.Between(45, 125),
      y: y + Math.sin(angle) * Phaser.Math.Between(35, 90),
      rotation: Phaser.Math.FloatBetween(-3, 3),
      alpha: 0,
      scale: 0,
      duration: 420,
      onComplete: () => piece.destroy(),
    });
  }
}
