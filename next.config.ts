import type { NextConfig } from "next";
import { join } from "node:path";
import { buildGameAssets } from "./lib/game/build-assets";

// Share one timestamp with build workers so prerendered HTML and client bundles agree.
const buildTime = (process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_TIME ??= new Date().toISOString());
const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
const buildId = `${buildCommit}:${buildTime}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GAME_ASSETS: JSON.stringify(buildGameAssets(join(process.cwd(), "public"))),
    NEXT_PUBLIC_SOKUDOKU_BUILD_ID: buildId,
    NEXT_PUBLIC_SOKUDOKU_BUILD_TIME: buildTime,
    NEXT_PUBLIC_SOKUDOKU_BUILD_COMMIT: buildCommit,
  },
  cacheComponents: true,
  partialPrefetching: true,
  headers: async () => [{
    source: "/game-assets/:path*",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  }],
};

export default nextConfig;
