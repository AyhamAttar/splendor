import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives in a pnpm monorepo and imports @splendor/engine, which is
  // symlinked from packages/engine — OUTSIDE this app dir. Turbopack does not
  // resolve files above its root, and it otherwise clamps the root to frontend/
  // (the nested .git boundary), which breaks/hangs resolution of the shared
  // package. Pointing the root at the workspace root fixes it. next build/dev
  // always run with cwd = this app dir, so its parent is the workspace root.
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
  // Engine ships compiled CJS + d.ts; listing it keeps bundling robust across
  // the monorepo boundary.
  transpilePackages: ["@splendor/engine"],
};

export default nextConfig;
