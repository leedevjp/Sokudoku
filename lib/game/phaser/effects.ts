import Phaser from "phaser";
import type { TrainingView } from "./board";
import type { Result } from "../types";
import { FLIGHT_MS } from "../rules";

/** Projectile and impact visuals are independent from scoring and progression. */
export function answerImpact(
  scene: Phaser.Scene,
  view: TrainingView,
  index: number | null,
  result: Result,
  onImpact: () => void,
) {
  const hit = () => {
    const at = view.wordView!;
    if (result === "correct") {
      burst(scene, at.x, at.y, view.c.blue);
      at.setVisible(false);
      scene.cameras.main.flash(90, 100, 190, 255, false);
    } else {
      burst(scene, at.x, at.y, view.c.red);
      if (index !== null) view.choices[index]?.setVisible(false);
      scene.cameras.main.shake(110, 0.004);
    }
    onImpact();
  };
  if (result === "timeout" || index === null) {
    view.drawTime(0);
    hit();
    return;
  }
  const flying = view.choices[index];
  scene.tweens.killTweensOf(flying);
  flying.setDepth(10);
  scene.tweens.add({
    targets: flying,
    x: view.wordView!.x,
    y: view.wordView!.y,
    scaleX: 0.72,
    scaleY: 0.72,
    duration: FLIGHT_MS,
    ease: "Cubic.In",
    onComplete: () => {
      flying.setVisible(false);
      hit();
    },
  });
}

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
