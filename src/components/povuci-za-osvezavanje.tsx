"use client";

/**
 * Pull down to refresh — at the owner's request, 07.09.2026.
 *
 * The app is installed to the home screen (`display: "standalone"`), which
 * means there is no address bar and therefore no reload button and no
 * platform pull-to-refresh. Until now the only way to see a booking a
 * colleague had just entered was to close the app entirely and open it again.
 * This is that, as a gesture.
 *
 * **What it refreshes.** `router.refresh()`, not `location.reload()`. It
 * re-fetches the server-rendered tree for the screen you are on and leaves
 * client state alone — so a half-typed booking survives an accidental pull,
 * which a full reload would throw away. The RSC request goes through the
 * service worker's `NetworkFirst` rule, so online it is genuinely fresh and
 * offline it falls back to the last copy; that second case is why the
 * indicator refuses to spin when `navigator.onLine` is false and says so
 * instead. Nothing is more corrosive than a refresh that appears to work.
 *
 * **Why the touch handlers are non-passive.** The pull has to suppress the
 * platform's own overscroll bounce while it is happening, which needs
 * `preventDefault`. That is why `touchmove` is registered with
 * `{ passive: false }` — and why it is careful to preventDefault *only* once
 * it is sure this is a downward pull from the very top, so ordinary scrolling
 * is never touched.
 *
 * The gesture is deliberately not offered to a mouse: a desktop browser has a
 * reload button, and a drag on a trackpad would collide with text selection.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, Loader2Icon, WifiOffIcon } from "lucide-react";
import { useNaMrezi } from "@/lib/mreza";
import { MAKS, PRAG, jeArmirano, napredak, pomerajZa } from "@/lib/povlacenje";
import { T } from "@/lib/tekst";

/** How long the "no connection" answer stays up before it slides away. */
const PORUKA_MS = 1600;

export function PovuciZaOsvezavanje() {
  const router = useRouter();
  const naMrezi = useNaMrezi();

  const [pomeraj, postaviPomeraj] = useState(0);
  const [bezMreze, postaviBezMreze] = useState(false);
  const [uToku, pokreni] = useTransition();
  /*
   * Whether a finger is currently on the screen and pulling. Mirrors the
   * `povlacim` ref below, which is what the listeners read; this is the copy
   * the render is allowed to read, and it exists for exactly one decision —
   * whether the indicator follows the finger (no easing) or springs back
   * (easing). It changes twice per gesture, not once per frame.
   */
  const [vucem, postaviVucem] = useState(false);

  /*
   * Refs rather than state for everything the gesture itself needs: a
   * `touchmove` fires dozens of times a second and must not queue a render to
   * decide whether it is even a pull.
   */
  const pocetnaY = useRef<number | null>(null);
  /*
   * The horizontal start, kept for one reason: since 09.09.2026 the list also
   * swipes sideways between Odlasci and Povratak, and a swipe that drifts a
   * few pixels downward must not open this indicator underneath it. A pull is
   * a pull only while it is going down more than it is going across.
   */
  const pocetnaX = useRef(0);
  const povlacim = useRef(false);

  /*
   * `touchend` needs the offset the pull reached, and the listeners are
   * registered once per transition — reading it from state inside them would
   * read the value from the render that registered them. A ref mirrors it.
   */
  const pomerajTrenutni = useRef(0);

  const otkazi = useCallback(() => {
    pocetnaY.current = null;
    povlacim.current = false;
    postaviVucem(false);
    postaviPomeraj(0);
  }, []);

  /**
   * Is the screen in a state where a pull means "refresh"?
   *
   * Not while one is already running, not unless the page is scrolled to the
   * very top, and not while a Sheet or Dialog is open — Radix locks the body
   * behind those, and a filter sheet that refreshed the page underneath it as
   * you scrolled its list would be a trap.
   */
  const smePovlacenje = useCallback(() => {
    if (uToku) return false;
    if (window.scrollY > 0) return false;
    if (document.body.hasAttribute("data-scroll-locked")) return false;
    if (document.querySelector("[data-state='open'][role='dialog']")) {
      return false;
    }
    return true;
  }, [uToku]);

  useEffect(() => {
    function pocetak(e: TouchEvent) {
      // A second finger means a pinch or a two-handed scroll, never this.
      if (e.touches.length !== 1 || !smePovlacenje()) {
        pocetnaY.current = null;
        return;
      }
      pocetnaY.current = e.touches[0]!.clientY;
      pocetnaX.current = e.touches[0]!.clientX;
      povlacim.current = false;
      postaviBezMreze(false);
    }

    function kretanje(e: TouchEvent) {
      const pocetna = pocetnaY.current;
      if (pocetna === null) return;

      const razlika = e.touches[0]!.clientY - pocetna;
      const poprecno = Math.abs(e.touches[0]!.clientX - pocetnaX.current);

      /*
       * Upward, sideways, or the page has scrolled away from the top under the
       * finger: this is a scroll or a tab swipe, not a pull. Let go of it
       * completely rather than waiting to see if it comes back — a gesture
       * that re-arms mid-swipe is how you get a refresh nobody asked for.
       */
      if (razlika <= 0 || poprecno > razlika || window.scrollY > 0) {
        if (povlacim.current) otkazi();
        return;
      }

      if (!povlacim.current) {
        povlacim.current = true;
        postaviVucem(true);
      }
      // Only now, once this is certainly a downward pull from the top. Any
      // earlier and ordinary scrolling would fight the handler.
      if (e.cancelable) e.preventDefault();
      postaviPomeraj(pomerajZa(razlika));
    }

    function kraj() {
      if (!povlacim.current) {
        pocetnaY.current = null;
        return;
      }

      const armirano = jeArmirano(pomerajTrenutni.current);
      pocetnaY.current = null;
      povlacim.current = false;
      postaviVucem(false);
      postaviPomeraj(0);

      if (!armirano) return;

      if (!naMrezi) {
        // Say so rather than spin. A spinner that resolves into the same stale
        // list is worse than no refresh at all: it teaches the owner that the
        // list he is looking at is current when it is not.
        postaviBezMreze(true);
        window.setTimeout(() => postaviBezMreze(false), PORUKA_MS);
        return;
      }

      // The indicator is held open by `uToku` from here — see `otvoren` in the
      // render. Nothing has to put it away afterwards.
      pokreni(() => router.refresh());
    }

    document.addEventListener("touchstart", pocetak, { passive: true });
    document.addEventListener("touchmove", kretanje, { passive: false });
    document.addEventListener("touchend", kraj, { passive: true });
    document.addEventListener("touchcancel", otkazi, { passive: true });

    return () => {
      document.removeEventListener("touchstart", pocetak);
      document.removeEventListener("touchmove", kretanje);
      document.removeEventListener("touchend", kraj);
      document.removeEventListener("touchcancel", otkazi);
    };
  }, [naMrezi, otkazi, pokreni, router, smePovlacenje]);

  useEffect(() => {
    pomerajTrenutni.current = pomeraj;
  }, [pomeraj]);

  /*
   * How far open the indicator is. While a refresh or the offline message is
   * up it sits at the threshold; otherwise it is wherever the finger left it.
   * Derived rather than stored, so nothing has to remember to close it.
   */
  const otvoren = uToku || bezMreze ? PRAG : pomeraj;
  const vidljiv = otvoren > 0;
  const napunjeno = napredak(otvoren);
  const armirano = jeArmirano(otvoren);

  const poruka = bezMreze
    ? T.osvezavanje.bezMreze
    : uToku
      ? T.osvezavanje.uToku
      : armirano
        ? T.osvezavanje.pusti
        : T.osvezavanje.povuci;

  return (
    <div
      aria-hidden={!vidljiv}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{
        transform: `translateY(${Math.max(0, otvoren - MAKS / 2)}px)`,
        // While the finger is down the indicator must track it exactly; the
        // easing is only for the release.
        transition: vucem ? "none" : "transform 200ms ease-out",
      }}
    >
      <div
        role="status"
        className="mt-[max(0.5rem,env(safe-area-inset-top))] flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-sm shadow-sm backdrop-blur"
        style={{ opacity: vidljiv ? Math.max(0.35, napunjeno) : 0 }}
      >
        {bezMreze ? (
          <WifiOffIcon aria-hidden="true" className="size-4 text-amber-600" />
        ) : uToku ? (
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ArrowDownIcon
            aria-hidden="true"
            className="size-4 transition-transform duration-150 motion-reduce:transition-none"
            // Points down while pulling, flips up once letting go would fire.
            style={{ transform: armirano ? "rotate(180deg)" : "none" }}
          />
        )}
        <span className="whitespace-nowrap">{poruka}</span>
      </div>
    </div>
  );
}
