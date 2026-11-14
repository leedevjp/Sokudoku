import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

export const gameAssetSources = [
  ...["meadow-original-v4", "mage-v5", "mage-idle-v1", "mage-locomotion-v1", "mandrakes-v5", "magic-v5", "forest-v1", "moon-ruins-v1", "combo-burst-v1", "emotion-v1"].map(name => `/battle/${name}.webp`),
  ...["dash", "hybrid", "jelly", "hybrid-combo", "miss-combo"].map(name => `/audio/audition-v1/${name}.wav`),
  "/audio/study-lobby-night-v1.mp3",
];

/** Build-time fingerprints: unchanged content keeps its URL across deployments. */
export function buildGameAssets(publicDir: string, sources = gameAssetSources) {
  const output = join(publicDir, "game-assets");
  mkdirSync(output, { recursive: true });
  return Object.fromEntries(sources.map(source => {
    const bytes = readFileSync(join(publicDir, source.slice(1)));
    const name = createHash("sha256").update(bytes).digest("hex") + extname(source);
    const target = join(output, name);
    if (!existsSync(target)) writeFileSync(target, bytes);
    return [source, `/game-assets/${name}`];
  }));
}
