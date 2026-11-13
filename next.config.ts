import type { NextConfig } from "next";

// Share one timestamp with build workers so prerendered HTML and client bundles agree.
const buildTime = (process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_TIME ??= new Date().toISOString());
const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
const buildId = `${buildCommit}:${buildTime}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SOKUDOKU_BUILD_ID: buildId,
    NEXT_PUBLIC_SOKUDOKU_BUILD_TIME: buildTime,
    NEXT_PUBLIC_SOKUDOKU_BUILD_COMMIT: buildCommit,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
