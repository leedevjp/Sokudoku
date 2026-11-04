import { dissolveCard, reducedEffects } from "./reward-effects";
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
      dissolveCard(scene, at, 300 * view.boardLayout.scale, view.c.blue);
      burst(scene, at.x, at.y, view.c.blue);
    } else {
      burst(scene, at.x, at.y, view.c.red);
      if (index !== null) view.choices[index]?.setVisible(false);
      if (!reducedEffects()) scene.cameras.main.shake(90, 0.002);
    }
    onImpact();
  };
  if (result === "timeout" || index === null || reducedEffects()) {
    if (result === "timeout") view.drawTime(0);
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
    ease: "Cubic.InOut",
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
  if (reducedEffects()) return;
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    const distance = 28 + (i % 3) * 18;
    const piece = scene.add
      .star(x, y, 4, 1.2, 4 + (i % 3), i % 3 ? color : 0xffc6dc, 0.85)
      .setDepth(24);
    scene.tweens.add({
      targets: piece,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      rotation: Math.PI / 4,
      alpha: 0,
      scale: 0.3,
      duration: 280,
      ease: "Cubic.Out",
      onComplete: () => piece.destroy(),
    });
  }
}
