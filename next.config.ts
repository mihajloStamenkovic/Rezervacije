import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in a parent directory
  // otherwise makes Turbopack guess wrong and warn on every start.
  turbopack: {
    root: import.meta.dirname,
  },

  async headers() {
    return [
      {
        /*
         * The service worker must never be served from the browser's HTTP
         * cache. A worker is the one file that can pin every other file, so a
         * stale copy of it does not expire on its own — it keeps handing back
         * the caching rules of a build that is no longer deployed. Browsers
         * cap service worker freshness at 24h by themselves; this makes it
         * zero.
         */
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
