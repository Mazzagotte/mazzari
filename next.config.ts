import type {NextConfig} from "next";

const config:NextConfig = {
  distDir:process.env.MAZZARI_WORKER_BUILD === "1" ? ".next" : process.env.NODE_ENV === "production" ? ".next-production" : ".next",
  outputFileTracingRoot:process.cwd(),
};

export default config;
