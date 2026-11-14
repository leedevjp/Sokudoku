import Phaser from "phaser";

export type Emotion = "hearts" | "confusion" | "anger";
const TEXTURE = "battle-emotion-v1";
const CLIPS = {
  hearts: { row: 0, step: 140, pause: 300 },
  confusion: { row: 1, step: 110, pause: 440 },
  anger: { row: 2, step: 90, pause: 360 },
} as const;

export function preloadEmotions(scene: Phaser.Scene) {
  if (!scene.textures.exists(TEXTURE))
    scene.load.image(TEXTURE, "/battle/emotion-v1.webp");
}

/** Fixed 64px cells preserve the authored rise and flutter; never trim frames. */
export class EmotionEffect {
  readonly sprite?: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) return;
    const texture = scene.textures.get(TEXTURE);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (let i = 0; i < 24; i++) {
      if (!texture.has(String(i)))
        texture.add(String(i), 0, (i % 8) * 64, Math.floor(i / 8) * 64, 64, 64);
    }
    this.sprite = scene.add.image(0, 0, TEXTURE, "0").setVisible(false);
  }
  hide() { this.sprite?.setVisible(false); }
  show(emotion: Emotion, elapsed: number, reduced: boolean, x: number, y: number, size: number) {
    const clip = CLIPS[emotion];
    const age = Math.max(0, elapsed) % (clip.step * 8 + clip.pause);
    const frame = reduced ? 2 : Math.floor(age / clip.step);
    this.sprite?.setVisible(frame < 8);
    if (frame >= 8) return;
    this.sprite?.setFrame(String(clip.row * 8 + frame))
      .setPosition(x, y).setDisplaySize(size, size)
      .setAlpha(reduced ? 0.8 : Math.min(1, (age + 70) / 140, (clip.step * 8 - age) / 90));
  }
}
