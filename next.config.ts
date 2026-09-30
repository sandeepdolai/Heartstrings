import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` is for the sandbox's Node server (`bun run start`).
  // Cloudflare OpenNext builds must use the default output — gate via env.
  ...(process.env.OPENNEXT_BUILD ? {} : { output: "standalone" }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
