"use client";

/**
 * *Izgled* — Svetla or Tamna, in Podešavanja. SPEC §6, added 09.09.2026 at the
 * owner's request.
 *
 * **It changes the screen on the tap, not on a save.** There is no *Sačuvaj*
 * here and nothing reaches the server: the choice is a `localStorage` key on
 * this phone (see `src/lib/tema.ts` for why it is not on the account), and a
 * theme that took a round trip to apply would be a theme that does not work in
 * a tunnel.
 *
 * **Neither button is pressed until it knows.** The server cannot know what
 * this phone chose — that is the point of storing it here — so the first paint
 * has nothing true to draw. Guessing would light the wrong half of the switch
 * and correct it a frame later, which reads as a bug. The row keeps its height
 * and its place while it waits, so nothing under it jumps when it arrives.
 *
 * Every account sees this. It is the one control on this screen that is not
 * the owner's alone, because it is about the phone in the hand rather than
 * about the business.
 */
import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import {
  BOJA_TRAKE,
  KLASA,
  KLJUC_TEME,
  TEME,
  procitajTemu,
  temaZaPrimenu,
  type Tema,
} from "@/lib/tema";
import { T } from "@/lib/tekst";
import { cn } from "@/lib/utils";

const IKONA = { svetla: SunIcon, tamna: MoonIcon } as const;
const NAZIV: Record<Tema, string> = {
  svetla: T.podesavanja.svetlaTema,
  tamna: T.podesavanja.tamnaTema,
};

/**
 * Put the choice on the page. The same three things the blocking script in
 * `layout.tsx` does, for the same reasons — they cannot share code, so they
 * share `tema.ts` instead.
 */
function primeni(tema: Tema) {
  const klase = document.documentElement.classList;
  klase.toggle(KLASA.tamna, tema === "tamna");
  klase.toggle(KLASA.svetla, tema === "svetla");
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    // `media` off, not just `content` rewritten — see the script in layout.tsx.
    meta.removeAttribute("media");
    meta.setAttribute("content", BOJA_TRAKE[tema]);
  }
}

const UPIT = "(prefers-color-scheme: dark)";

/*
 * The theme is an external store — `localStorage` plus the phone's own
 * preference — so it is read with `useSyncExternalStore` rather than copied
 * into state by an effect. Two things fall out of that and both are wanted:
 * the server snapshot is `null`, which is honestly "this machine cannot know",
 * and while nothing is stored a phone that flips to night mode moves the
 * pressed button with it.
 *
 * `localStorage` fires no event in the tab that wrote it, so the tap has to
 * say so itself — that is what `obavesti` is.
 */
const slusaoci = new Set<() => void>();

function pretplati(osvezi: () => void) {
  const upit = window.matchMedia(UPIT);
  slusaoci.add(osvezi);
  upit.addEventListener("change", osvezi);
  return () => {
    slusaoci.delete(osvezi);
    upit.removeEventListener("change", osvezi);
  };
}

function obavesti() {
  for (const osvezi of slusaoci) osvezi();
}

function snimak(): Tema {
  let sacuvana: Tema | null = null;
  try {
    sacuvana = procitajTemu(localStorage.getItem(KLJUC_TEME));
  } catch {
    // Storage can be off entirely. The switch still works for this session.
  }
  return temaZaPrimenu(sacuvana, window.matchMedia(UPIT).matches);
}

/** The server has no phone to ask. Nothing is pressed until the client says. */
function snimakNaServeru(): null {
  return null;
}

export function PrekidacTeme() {
  const tema = useSyncExternalStore(pretplati, snimak, snimakNaServeru);

  function izaberi(nova: Tema) {
    primeni(nova);
    try {
      localStorage.setItem(KLJUC_TEME, nova);
    } catch {
      // Nothing to do and nothing to say: the screen already changed, it just
      // will not be remembered. Saying so would be noise on a settings page.
    }
    obavesti();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{T.podesavanja.izgled}</h2>
      <div className="grid grid-cols-2 gap-2">
        {TEME.map((mogucnost) => {
          const Ikona = IKONA[mogucnost];
          const izabrana = tema === mogucnost;
          return (
            <button
              key={mogucnost}
              type="button"
              // Until the effect has run there is nothing true to say here, so
              // the buttons are inert rather than wrong.
              disabled={tema === null}
              aria-pressed={izabrana}
              onClick={() => izaberi(mogucnost)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg border text-base transition-colors",
                izabrana
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background active:bg-muted",
                tema === null && "opacity-0",
              )}
            >
              <Ikona aria-hidden="true" className="size-5" />
              {NAZIV[mogucnost]}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {T.podesavanja.izgledPomoc}
      </p>
    </section>
  );
}
