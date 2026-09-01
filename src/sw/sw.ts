/**
 * The service worker — SPEC §9, Phase 6.
 *
 * Built by `npm run build:sw` into `public/sw.js`, which is generated and
 * git-ignored. It is a separate esbuild step rather than part of `next build`
 * because `@serwist/next`'s default export is a webpack plugin and this
 * project builds with Turbopack; the supported Turbopack path is the
 * configurator in `serwist.config.mjs`. Registration happens in
 * `src/components/registracija-sw.tsx`.
 *
 * **The whole policy in one sentence: reads may fall back to the last known
 * copy, writes never do.**
 *
 * Serwist keys its route table by HTTP method and every rule below defaults
 * to `GET`. A `POST` therefore matches nothing, the worker calls neither a
 * handler nor `respondWith`, and the request goes to the network exactly as
 * if no service worker were installed. Offline that fails immediately and
 * visibly, which is the intent: a booking that silently replays two hours
 * later is a duplicate the owner never learns about. There is no background
 * sync in this file and there must not be one.
 *
 * Order matters — the first matching rule wins.
 */
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";
import { KES } from "../lib/kes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Replaced at build time by `serwist build` with the precache manifest. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Three seconds, everywhere a fallback exists.
 *
 * The user this is built for is in a parked van on foreign roaming, where the
 * failure mode is not "no signal" but "a signal that takes twenty seconds to
 * admit it is not working". A spinner that long is indistinguishable from a
 * broken app, and yesterday's list answers most questions.
 */
const CEKANJE_MREZE = 3;

const pravila: RuntimeCaching[] = [
  // Supabase — the token refresh and any REST call. Never cached, at any
  // stage: a cached auth response is either a stale session or somebody
  // else's. Cross-origin here means Supabase and nothing else; the Geist
  // fonts are self-hosted out of /_next/static by next/font.
  {
    matcher: ({ sameOrigin }) => !sameOrigin,
    handler: new NetworkOnly(),
  },

  // The login screen. Never cached — a login form served from disk cannot be
  // trusted to be the current one, and it is the one page that is worthless
  // offline anyway, since signing in needs the network by definition.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/prijava"),
    handler: new NetworkOnly(),
  },

  // Next's build output. Every filename carries a content hash, so a hit can
  // never be stale — CacheFirst is correct and avoids a pointless round trip
  // on every load. The precache manifest already holds the files present at
  // build time; this catches chunks loaded later.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: KES.GRADNJA,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 96,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },

  // Icons and the manifest. They change roughly never, and a stale one is a
  // cosmetic problem rather than a wrong answer.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname.startsWith("/ikone/") ||
        url.pathname === "/manifest.webmanifest" ||
        url.pathname === "/favicon.ico"),
    handler: new StaleWhileRevalidate({
      cacheName: KES.SREDSTVA,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },

  // RSC prefetches — what a `<Link>` fetches when it scrolls into view. Kept
  // in their own cache because a prefetch payload is a partial tree and must
  // never be handed back as the answer to a real navigation.
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin &&
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1",
    handler: new NetworkFirst({
      cacheName: KES.RSC_NAJAVA,
      networkTimeoutSeconds: CEKANJE_MREZE,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    }),
  },

  // RSC payloads — a tap on a card or on Nazad.
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin && request.headers.get("RSC") === "1",
    handler: new NetworkFirst({
      cacheName: KES.RSC,
      networkTimeoutSeconds: CEKANJE_MREZE,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    }),
  },

  // Full page loads. This is the rule that makes the list survive an offline
  // reload, which is the one offline behaviour that actually matters: open
  // the app in a dead spot and the last known schedule is on screen.
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: KES.STRANICE,
      networkTimeoutSeconds: CEKANJE_MREZE,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    }),
  },

  // Anything else same-origin and GET. Not cached, not intercepted in any
  // meaningful way — better an honest failure than a guess about a request
  // this file has not thought about.
  {
    matcher: ({ sameOrigin }) => sameOrigin,
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Drop the previous deployment's precache on activate, rather than
    // letting a phone that is opened twice a week accumulate every build.
    cleanupOutdatedCaches: true,
  },
  // Take over immediately rather than waiting for every tab to close. A
  // two-person app has one tab, and a worker that activates "eventually"
  // means a bug fix that ships tomorrow.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: pravila,
});

serwist.addEventListeners();
