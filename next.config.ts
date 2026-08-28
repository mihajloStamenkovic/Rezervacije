import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in a parent directory
  // otherwise makes Turbopack guess wrong and warn on every start.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
