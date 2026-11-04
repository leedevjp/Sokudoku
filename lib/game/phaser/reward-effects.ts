import Phaser from "phaser";
export const reducedEffects = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Small glass petals and light, bounded to the existing feedback interval. */
export function dissolveCard(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  size: number,
  color: number,
) {
  if (reducedEffects()) {
    card.setAlpha(0.45);
    return;
  }
  scene.tweens.add({
    targets: card,
    alpha: 0,
    scale: 1.06,
    duration: 240,
    ease: "Sine.Out",
  });
  const ring = scene.add
    .circle(card.x, card.y, size * 0.28)
    .setStrokeStyle(2, color, 0.65)
    .setDepth(22);
  scene.tweens.add({
    targets: ring,
    scale: 1.8,
    alpha: 0,
    duration: 280,
    ease: "Cubic.Out",
    onComplete: () => ring.destroy(),
  });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const radius = size * 0.23;
    const shard = scene.add
      .graphics({
        x: card.x + Math.cos(a) * radius,
        y: card.y + Math.sin(a) * radius,
      })
      .setDepth(23);
    const length = size * (i % 2 ? 0.15 : 0.2),
      width = length * 0.48;
    shard
      .fillStyle(i % 3 ? 0xe5f5ff : 0xffe6ed, 0.85)
      .lineStyle(1, i % 3 ? color : 0xf6aac6, 0.65);
    const points = [
      new Phaser.Math.Vector2(-width, 0),
      new Phaser.Math.Vector2(0, -length),
      new Phaser.Math.Vector2(width, 0),
      new Phaser.Math.Vector2(0, length * 0.45),
    ];
    shard
      .fillPoints(points, true)
      .strokePoints(points, true)
      .setRotation(a + Math.PI / 2);
    scene.tweens.add({
      targets: shard,
      x: card.x + Math.cos(a) * size * 0.6,
      y: card.y + Math.sin(a) * size * 0.6,
      rotation: shard.rotation + (i % 2 ? 0.3 : -0.3),
      alpha: 0,
      scale: 0.35,
      duration: 300,
      ease: "Cubic.Out",
      onComplete: () => shard.destroy(),
    });
  }
}
/** Drawn from the pet's persistent reaction clock: survives question redraws. */
export function paintHearts(
  g: Phaser.GameObjects.Graphics,
  elapsed: number,
  size: number,
  reduced: boolean,
) {
  g.clear();
  const time = reduced ? 240 : elapsed;
  for (let i = 0; i < (reduced ? 1 : 3); i++) {
    const t = (time - i * 70) / 440;
    if (t < 0 || t > 1) continue;
    const alpha = Math.sin(t * Math.PI),
      radius = size * (0.065 + i * 0.01);
    const x = (i - 1) * size * 0.22 + Math.sin(t * Math.PI) * (i % 2 ? -5 : 5);
    const y = -size * (0.26 + t * 0.6);
    const points = Array.from({ length: 40 }, (_, k) => {
      const a = (k * Math.PI * 2) / 40;
      return new Phaser.Math.Vector2(
        x + radius * Math.pow(Math.sin(a), 3),
        y -
          (radius *
            (13 * Math.cos(a) -
              5 * Math.cos(2 * a) -
              2 * Math.cos(3 * a) -
              Math.cos(4 * a))) /
            16,
      );
    });
    g.fillStyle(i === 1 ? 0xffa5c9 : 0xf271a4, alpha).fillPoints(points, true);
    g.fillStyle(0xffffff, alpha * 0.85).fillCircle(
      x - radius * 0.4,
      y - radius * 0.35,
      radius * 0.14,
    );
  }
}
