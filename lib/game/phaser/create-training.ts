import Phaser from "phaser";
import { TrainingScene } from "./scene";
import type { TrainingOptions } from "./types";
import { palette } from "../preferences";

/** High-DPI framebuffer, bounded to keep large desktops from allocating huge surfaces. */
function densityFor(parent: HTMLElement) {
  const width = Math.max(1, parent.clientWidth),
    height = Math.max(1, parent.clientHeight);
  return Math.max(
    1,
    Math.min(
      window.devicePixelRatio || 1,
      3,
      4096 / Math.max(width, height),
      Math.sqrt(8_388_608 / (width * height)),
    ),
  );
}
export function createTraining(parent: HTMLElement, options: TrainingOptions) {
  let density = densityFor(parent);
  const scene = new TrainingScene(options, density);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette[options.preferences.theme].bg,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(parent.clientWidth * density),
      height: Math.round(parent.clientHeight * density),
      zoom: 1 / density,
      autoRound: false,
    },
    render: { antialias: true, antialiasGL: true, pixelArt: false },
    input: { activePointers: 3 },
    scene: [scene],
    audio: { noAudio: false },
  });
  const resizeCanvas = () => {
    if (!game.isBooted) return;
    const nextDensity = densityFor(parent);
    const width = Math.round(parent.clientWidth * nextDensity),
      height = Math.round(parent.clientHeight * nextDensity);
    if (width < 1 || height < 1) return;
    if (
      game.scale.width === width &&
      game.scale.height === height &&
      nextDensity === density
    )
      return;
    const changed = nextDensity !== density;
    density = nextDensity;
    scene.setRenderDensity(density);
    if (changed) game.scale.setZoom(1 / density);
    game.scale.resize(width, height);
  };
  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(parent);
  window.addEventListener("resize", resizeCanvas);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    window.removeEventListener("resize", resizeCanvas);
  });
  return game;
}
