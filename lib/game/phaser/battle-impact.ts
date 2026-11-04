import Phaser from "phaser";
import { HIT_STOP_MS } from "../battle-timing";

/** Local contact flash, sharp radial strokes and dust; never shakes the camera. */
export function paintContact(
  g: Phaser.GameObjects.Graphics,
  age: number,
  s: number,
) {
  if (age < 0 || age > 260) return;
  const fade = Math.max(0, 1 - Math.max(0, age - HIT_STOP_MS) / 212);
  const spread = Math.min(1, Math.max(0, age - HIT_STOP_MS) / 170);
  if (age < 100) {
    const points = Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      const r = (i % 2 ? 10 : i % 4 ? 29 : 42) * s;
      return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
    g.fillStyle(0xffd25b, fade)
      .lineStyle(2 * s, 0xa65f2c, fade)
      .fillPoints(points, true)
      .strokePoints(points, true);
    g.fillStyle(0xfffff0, fade).fillCircle(0, 0, 13 * s);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9 + 0.15;
    const r = (20 + spread * 48) * s;
    const length = (18 - spread * 12) * s;
    g.lineStyle((i % 2 ? 3 : 5) * s, i % 2 ? 0xfff7cf : 0xe9a944, fade);
    g.lineBetween(
      Math.cos(a) * r,
      Math.sin(a) * r,
      Math.cos(a) * (r + length),
      Math.sin(a) * (r + length),
    );
    g.fillStyle(0xf6e3b3, fade * 0.8).fillCircle(
      (i - 4) * (8 + spread * 7) * s,
      (22 + spread * (i % 3) * 8) * s,
      (4 - spread * 2) * s,
    );
  }
}
export function paintSpeed(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  strength: number,
) {
  for (let i = 0; i < 4; i++) {
    const yy = y - (24 + i * 17) * s;
    g.lineStyle(
      (3 - i * 0.4) * s,
      i % 2 ? 0xfff8de : 0xeac16b,
      strength * 0.85,
    );
    g.lineBetween(
      x - (50 + i * 7) * s,
      yy,
      x - (85 + i * 13 + strength * 36) * s,
      yy,
    );
  }
}
