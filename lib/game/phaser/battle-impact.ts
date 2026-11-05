import type Phaser from "phaser";
import { HIT_STOP_MS } from "../battle-timing";
/** Square pixel clusters, using the same two-design-pixel grid as the scenery. */
export function paintContact(
  g: Phaser.GameObjects.Graphics,
  age: number,
  s: number,
) {
  if (age < 0 || age > 260) return;
  const unit = 2 * s;
  const fade = Math.max(0, 1 - Math.max(0, age - HIT_STOP_MS) / 212);
  const spread = Math.min(1, Math.max(0, age - HIT_STOP_MS) / 170);
  const dot = (x: number, y: number, color: number, size = 1) =>
    g
      .fillStyle(color, fade)
      .fillRect(
        Math.round(x) * unit,
        Math.round(y) * unit,
        unit * size,
        unit * size,
      );
  if (age < 100) {
    for (let y = -13; y <= 13; y++)
      for (let x = -13; x <= 13; x++) {
        const ax = Math.abs(x),
          ay = Math.abs(y);
        if (ax + ay < 9 || (ax < 2 && ay < 14) || (ay < 2 && ax < 14))
          dot(x, y, ax + ay < 6 ? 0xfff6cf : 0xf5bb45);
      }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = 12 + spread * 19;
    for (let k = 0; k < 4; k++)
      dot(Math.cos(a) * (r + k), Math.sin(a) * (r + k), 0xf4c968, 2);
  }
}
export function paintSpeed(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  strength: number,
) {
  const unit = 2 * s;
  for (let i = 0; i < 4; i++)
    g.fillStyle(i % 2 ? 0xfff3c3 : 0xd7aa67, strength * 0.85).fillRect(
      Math.round((x - (85 + i * 10) * s) / unit) * unit,
      Math.round((y - (24 + i * 16) * s) / unit) * unit,
      Math.round((16 + strength * 25) / 2) * unit,
      unit,
    );
}
