import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` is for the sandbox's Node server (`bun run start`).
  // Cloudflare OpenNext builds must use the default output — gate via env.
  ...(process.env.OPENNEXT_BUILD ? {} : { output: "standalone" }),
  // Keep non-app directories out of the standalone file trace — the OpenNext
  // server bundle copies everything traced, and the sandbox's skills library,
  // QA downloads, dev database and mini-services would balloon the worker
  // bundle past the disk limit (found the hard way: ENOSPC mid-bundle).
  outputFileTracingExcludes: {
    "*": [
      "./skills/**",
      "./download/**",
      "./upload/**",
      "./tool-results/**",
      "./mini-services/**",
      "./db/**",
      "./dev.log",
      "./server.log",
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
