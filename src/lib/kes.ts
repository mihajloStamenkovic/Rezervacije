/**
 * The names of the service worker's caches.
 *
 * Shared, because two places need to agree on them: `src/sw/sw.ts` fills
 * them, and `src/components/ciscenje-kesa.tsx` empties them when the login
 * screen appears. A typo in one of the two would produce a worker that
 * caches reservations and a logout that quietly fails to remove them.
 *
 * `GRADNJA` is deliberately absent from `KESEVI_SA_PODACIMA`: it holds
 * content-hashed JS and CSS from `/_next/static`, which is the same for
 * everyone and contains no booking.
 */
export const KES = {
  /** HTML documents — a full page load, which is what an offline reload gets. */
  STRANICE: "stranice",
  /** React Server Component payloads — what a tap on a `<Link>` fetches. */
  RSC: "rsc",
  /** RSC prefetches, kept apart: a prefetch is a partial payload, not a page. */
  RSC_NAJAVA: "rsc-najava",
  /** Content-hashed build output. Immutable by construction. */
  GRADNJA: "gradnja",
  /** Icons and the manifest out of `public/`. */
  SREDSTVA: "sredstva",
} as const;

/**
 * The caches that can contain somebody's name, phone number or itinerary.
 * These are the ones that get deleted at the login screen.
 */
export const KESEVI_SA_PODACIMA: readonly string[] = [
  KES.STRANICE,
  KES.RSC,
  KES.RSC_NAJAVA,
];
