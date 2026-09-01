/**
 * Build options for the service worker, consumed by `serwist build`.
 *
 * Why this file exists at all: `@serwist/next`'s default export is a webpack
 * plugin. Next 16 builds with Turbopack (see `next.config.ts`, which pins the
 * workspace root for it), and under Turbopack that plugin prints a warning
 * and silently produces no worker. The supported alternative is Serwist's
 * "configurator mode" — this file plus the `serwist` CLI, run as a second
 * step after `next build`.
 *
 * `serwist()` from `@serwist/next/config` is what makes the output Next-aware:
 * it loads `next.config.ts`, globs `.next/static` and `public/`, and rewrites
 * every `.next/…` path in the precache manifest to the `/_next/…` URL the
 * browser will actually request.
 *
 * `precachePrerendered` is off. It would glob `.next/server/app/**\/*.html`,
 * and the only route in this app that prerenders is `/prijava` — the one page
 * the worker is under instruction never to cache.
 */
import { serwist } from "@serwist/next/config";

export default await serwist.withNextConfig((nextConfig) => ({
  swSrc: "src/sw/sw.ts",
  swDest: "public/sw.js",
  precachePrerendered: false,
  /*
   * Serwist's default patterns for a Next app leave out `woff2`, so the Geist
   * faces would only reach the cache on a load that already worked. Adding
   * them means the very first offline start renders in the app's own type
   * instead of falling back to the system font — which matters more here than
   * it looks, because the fallback has to carry č, ć, š, ž and đ.
   *
   * `withNextConfig` is used rather than a literal `.next/` so that the two
   * places that name the build directory cannot drift apart.
   */
  globPatterns: [
    `${nextConfig.distDir}/static/**/*.{js,css,ico,png,svg,webp,json,woff,woff2}`,
    "public/**/*",
  ],
}));
