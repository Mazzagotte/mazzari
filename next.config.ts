import type { NextConfig } from "next";

const config: NextConfig = {
  distDir:
    process.env.MAZZARI_WORKER_BUILD === "1"
      ? ".next"
      : process.env.NODE_ENV === "production"
        ? ".next-production"
        : ".next",
  outputFileTracingRoot: process.cwd(),
  // The Windows launcher sets this to run a trimmed server (node server.js) instead of `next start`.
  ...(process.env.MAZZARI_STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default config;
