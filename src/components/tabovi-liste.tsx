"use client";

/**
 * The two tabs of the list — *Odlasci* and *Povratak*. SPEC §2 and §6,
 * amended 09.09.2026 at the owner's request.
 *
 * **Both panels are rendered on the server, every time.** `prikaziListu`
 * returns both lists in one pass, so changing tab is a client-side move: no
 * second request, nothing to wait for, and it works with no connection on a
 * list the service worker already has. That is the whole reason the swipe can
 * follow the finger at all.
 *
 * **The URL still owns the state.** The tab is `?tab=povratak`, written on a
 * short debounce with `router.replace` exactly as the search box writes `?q=`
 * — the address bar is what a reload, a shared link and the back button read,
 * and letting the two disagree is how you end up with a tab that resets itself.
 * The debounce also means two quick swipes cost one navigation rather than two.
 *
 * **The gesture.** A finger has to move `PRAG_OSE` pixels before this decides
 * whether it is scrolling or swiping, and horizontal has to win by a clear
 * margin — see `src/lib/prevlacenje.ts`, where all of that is arithmetic with
 * a test around it. Once it is a swipe the panel tracks the finger, and on
 * release past a quarter of the screen the tab changes; the transform is then
 * re-based so the incoming panel carries on from exactly where it was drawn
 * rather than jumping to its new home.
 *
 * `touch-action: pan-y` is what keeps the browser's own horizontal gestures
 * out of it while leaving vertical scrolling entirely alone — the document is
 * still the scroller, which is what pull-to-refresh reads.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Smer } from "@/domen/tipovi";
import {
  odlukaOse,
  pomerajPrevlacenja,
  prebacujeLi,
  susedniIndeks,
} from "@/lib/prevlacenje";
import { T } from "@/lib/tekst";
import { putanjaListe, type StanjeUrl } from "@/lib/url-stanje";
import { cn } from "@/lib/utils";

/** Left to right, and the order the swipe moves through. */
const TABOVI: readonly Smer[] = ["odlazak", "povratak"];

const NAZIV: Record<Smer, string> = {
  odlazak: T.tabovi.odlasci,
  povratak: T.tabovi.povratak,
};

/** How long the URL waits behind the finger. Same idea as the search box. */
const ODLAGANJE_MS = 200;

type Kontekst = { aktivan: Smer; postavi: (smer: Smer) => void };

const KontekstTabova = createContext<Kontekst | null>(null);

function useTabovi(): Kontekst {
  const kontekst = useContext(KontekstTabova);
  if (!kontekst) {
    throw new Error("Traka, panel i dugme moraju biti unutar <TaboviListe>.");
  }
  return kontekst;
}

/**
 * Holds which tab is open and keeps the URL behind it.
 *
 * The state is seeded from the URL and follows it whenever a navigation
 * changes it under us — the back button, a link carrying `?tab=`, or the
 * filter sheet applying a filter. Adjusting state during render rather than in
 * an effect, so the right tab is never shown one frame late.
 */
export function TaboviListe({
  stanje,
  children,
}: {
  stanje: StanjeUrl;
  children: ReactNode;
}) {
  const router = useRouter();
  const [aktivan, postaviAktivan] = useState<Smer>(stanje.tab);
  const [izUrl, postaviIzUrl] = useState<Smer>(stanje.tab);
  if (izUrl !== stanje.tab) {
    postaviIzUrl(stanje.tab);
    postaviAktivan(stanje.tab);
  }

  useEffect(() => {
    // Once the navigation lands the URL says what is on screen and this is a
    // no-op, which is what stops the debounce from feeding itself.
    if (aktivan === stanje.tab) return;
    const id = setTimeout(() => {
      router.replace(putanjaListe({ ...stanje, tab: aktivan }), {
        scroll: false,
      });
    }, ODLAGANJE_MS);
    return () => clearTimeout(id);
  }, [aktivan, stanje, router]);

  const postavi = useCallback((smer: Smer) => postaviAktivan(smer), []);

  return (
    <KontekstTabova.Provider value={{ aktivan, postavi }}>
      {children}
    </KontekstTabova.Provider>
  );
}

/**
 * The tab strip. Lives in the sticky header, so the two counts are readable
 * without scrolling back up — the number on the tab you are *not* on is the
 * useful half.
 */
export function TrakaTabova({ brojevi }: { brojevi: Record<Smer, number> }) {
  const { aktivan, postavi } = useTabovi();

  return (
    <div
      role="tablist"
      aria-label={T.tabovi.izbor}
      className="flex px-4"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const pomak = e.key === "ArrowLeft" ? -1 : 1;
        const sledeci = TABOVI[TABOVI.indexOf(aktivan) + pomak];
        if (!sledeci) return;
        e.preventDefault();
        postavi(sledeci);
      }}
    >
      {TABOVI.map((smer) => {
        const izabran = smer === aktivan;
        return (
          <button
            key={smer}
            type="button"
            role="tab"
            id={`tab-${smer}`}
            aria-selected={izabran}
            aria-controls={`panel-${smer}`}
            // Arrow keys move between tabs, so only the open one is a tab stop.
            tabIndex={izabran ? 0 : -1}
            onClick={() => postavi(smer)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 border-b-2 text-sm font-medium transition-colors",
              izabran
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            {NAZIV[smer]}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                izabran
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {brojevi[smer]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The two panels, side by side, with the swipe on top of them.
 *
 * Only the open panel is in the flow — it is what gives the container its
 * height, so the document scrolls exactly as far as the list you are reading.
 * The other sits absolutely a screen away and is clipped horizontally, which
 * is why `overflow-x: clip` and not `hidden`: `clip` leaves the vertical axis
 * `visible`, so the page keeps its single scroller and the sticky header and
 * pull-to-refresh keep working.
 */
export function PanelTabova({
  odlasci,
  povratci,
}: {
  odlasci: ReactNode;
  povratci: ReactNode;
}) {
  const { aktivan, postavi } = useTabovi();
  const okvir = useRef<HTMLDivElement>(null);

  const [pomeraj, postaviPomeraj] = useState(0);
  /*
   * Whether a finger is on the panel right now. The only thing it decides is
   * whether the transform follows the finger exactly (no transition) or
   * springs to rest (transition) — it changes twice per gesture, not once per
   * frame, which is why it is state and everything below is a ref.
   */
  const [vucem, postaviVucem] = useState(false);

  const pocetna = useRef<{ x: number; y: number } | null>(null);
  const osa = useRef<"x" | "y" | null>(null);
  /* `touchend` needs the offset the drag reached; the listeners are registered
     once per tab, so reading it from state inside them would read the value
     from the render that registered them. */
  const trenutni = useRef(0);

  useEffect(() => {
    trenutni.current = pomeraj;
  }, [pomeraj]);

  const indeks = TABOVI.indexOf(aktivan);

  useEffect(() => {
    const element = okvir.current;
    if (!element) return;

    function otkazi() {
      pocetna.current = null;
      osa.current = null;
      postaviVucem(false);
      postaviPomeraj(0);
    }

    function pocetak(e: TouchEvent) {
      // A second finger is a pinch or a two-handed scroll, never this.
      if (e.touches.length !== 1) {
        pocetna.current = null;
        return;
      }
      const dodir = e.touches[0]!;
      pocetna.current = { x: dodir.clientX, y: dodir.clientY };
      osa.current = null;
    }

    function kretanje(e: TouchEvent) {
      const odakle = pocetna.current;
      if (!odakle || osa.current === "y") return;

      const dodir = e.touches[0]!;
      const dx = dodir.clientX - odakle.x;
      const dy = dodir.clientY - odakle.y;

      if (osa.current === null) {
        osa.current = odlukaOse(dx, dy);
        // Still ambiguous, or a scroll: either way, hands off.
        if (osa.current !== "x") return;
        postaviVucem(true);
      }

      // Only now, once this is certainly a horizontal drag. Any earlier and
      // the handler would be fighting ordinary scrolling.
      if (e.cancelable) e.preventDefault();
      const sused = susedniIndeks(indeks, dx, TABOVI.length);
      postaviPomeraj(pomerajPrevlacenja(dx, sused !== null));
    }

    function kraj() {
      const bio = osa.current === "x";
      pocetna.current = null;
      osa.current = null;
      if (!bio) return;

      const dokle = trenutni.current;
      const sused = susedniIndeks(indeks, dokle, TABOVI.length);
      const sirina = element!.clientWidth;

      if (sused === null || !prebacujeLi(dokle, sirina)) {
        postaviVucem(false);
        postaviPomeraj(0);
        return;
      }

      /*
       * The incoming panel is on screen at `±sirina + kraj`. A moment from now
       * it is the one in the flow, at `0 + pomeraj` — so it is re-based to the
       * same pixel it already occupies, with the transition still off, and
       * only then animated home. Without this the panel would jump a full
       * screen width at the exact moment the finger leaves it.
       */
      postavi(TABOVI[sused]!);
      postaviPomeraj(dokle < 0 ? sirina + dokle : dokle - sirina);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          postaviVucem(false);
          postaviPomeraj(0);
        }),
      );
    }

    element.addEventListener("touchstart", pocetak, { passive: true });
    element.addEventListener("touchmove", kretanje, { passive: false });
    element.addEventListener("touchend", kraj, { passive: true });
    element.addEventListener("touchcancel", otkazi, { passive: true });

    return () => {
      element.removeEventListener("touchstart", pocetak);
      element.removeEventListener("touchmove", kretanje);
      element.removeEventListener("touchend", kraj);
      element.removeEventListener("touchcancel", otkazi);
    };
  }, [indeks, postavi]);

  return (
    <div ref={okvir} className="relative touch-pan-y overflow-x-clip">
      <div
        style={{
          transform: `translate3d(${pomeraj}px, 0, 0)`,
          transition: vucem
            ? "none"
            : "transform 240ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {TABOVI.map((smer, i) => {
          const otvoren = smer === aktivan;
          return (
            <div
              key={smer}
              role="tabpanel"
              id={`panel-${smer}`}
              aria-labelledby={`tab-${smer}`}
              // The panel off screen is out of the tab order and out of the
              // accessibility tree; it is a screen away, not a second column.
              aria-hidden={!otvoren}
              inert={!otvoren}
              className={cn("w-full", !otvoren && "absolute top-0")}
              style={otvoren ? undefined : { left: `${(i - indeks) * 100}%` }}
            >
              {smer === "odlazak" ? odlasci : povratci}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The fixed *Nova rezervacija* bar.
 *
 * It is here rather than in the page because the `nazad` it carries has to
 * name the tab that is open *now* — save a booking from the returns tab and
 * you come back to the returns tab.
 */
export function DugmeNove({ stanje }: { stanje: StanjeUrl }) {
  const { aktivan } = useTabovi();
  const nazad = putanjaListe({ ...stanje, tab: aktivan });

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <Button asChild className="h-12 w-full gap-2 text-base">
        <Link href={`/nova?nazad=${encodeURIComponent(nazad)}`}>
          <PlusIcon className="size-5" />
          {T.lista.novaRezervacija}
        </Link>
      </Button>
    </div>
  );
}
