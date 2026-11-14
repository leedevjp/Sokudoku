import test from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { SceneMedia } from "../lib/game/phaser/scene-media";
import { battleImages } from "../lib/game/phaser/presentation-assets";

test("late battle textures notify the visible quiz without waiting for audio", async t => {
  let release!: () => void;
  const imageGate = new Promise<void>(resolve => { release = resolve; });
  let readyCalls = 0;
  const media = new SceneMedia(
    { textures: { exists: () => false } } as unknown as Phaser.Scene,
    () => { readyCalls++; },
  );
  const internal = media as unknown as {
    image: (key: string, source: string, priority?: boolean) => Promise<void>;
    audio: (file: string) => Promise<void>;
  };
  t.mock.method(internal, "image", async (key: string) => {
    if (key === battleImages[0][0]) await imageGate;
  });
  // Optional audio may hang or decode slowly; it must not block the actors.
  t.mock.method(internal, "audio", () => new Promise<void>(() => {}));
  media.start();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(readyCalls, 0);
  release();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(readyCalls, 1);
  media.close();
});
