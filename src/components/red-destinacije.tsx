"use client";

/**
 * One leg of the trip as a single row — SPEC §6, screen 3, restyled from the
 * design canvas on 09.09.2026.
 *
 * The form used to carry the cascade itself: two legs × up to three dropdowns
 * is six selects stacked down a phone screen, and the destination — the thing
 * the booking is *about* — looked exactly like every other field. Now each leg
 * is one line that reads `Grčka › Kasandra › Hanioti`, and the dropdowns live
 * in a sheet behind it.
 *
 * **The sheet edits a draft.** Nothing reaches the form until *Potvrdi*, for
 * the reason the filter sheet gives: half a selection is not a value the form
 * can hold, and applying live would let a country picked with no town yet wipe
 * the destination that was already there. Closing without confirming leaves
 * the booking exactly as it was.
 *
 * **The hidden inputs stay behind in the form.** Radix portals a sheet to the
 * end of `<body>`, outside the `<form>`, so a hidden input rendered inside it
 * is one the Server Action never sees. They are rendered here instead and the
 * cascade is told not to — see `skrivenaPolja` in `kaskada-destinacija.tsx`.
 * This is the kind of thing that fails silently and only on save, which is why
 * it is written down.
 */
import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import {
  KaskadaDestinacija,
  SkrivenaPolja,
  type Odabir,
} from "@/components/kaskada-destinacija";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { punoImeDestinacije } from "@/domen/destinacije";
import type { Destinacija, Smer } from "@/domen/tipovi";
import { T } from "@/lib/tekst";
import { cn } from "@/lib/utils";

/** `Grčka › Kasandra › Hanioti`, whether the place is stored or being typed. */
function opisOdabira(odabir: Odabir, katalog: Destinacija[]): string | null {
  if (odabir.id !== null) {
    const d = katalog.find((x) => x.id === odabir.id);
    return d ? punoImeDestinacije(d) : null;
  }
  if (odabir.novo === null) return null;

  // A place still being typed has no row to read a country name off, so the
  // catalogue supplies it from the code the cascade sent.
  const { drzavaSifra, regija, grad } = odabir.novo;
  if (grad.trim() === "") return null;
  const drzava = katalog.find((d) => d.drzavaSifra === drzavaSifra)?.drzava;
  return [drzava, regija, grad].filter((x) => x && x.trim() !== "").join(" › ");
}

export function RedDestinacije({
  idPolja,
  naziv,
  oznaka,
  smer,
  katalog,
  vrednost,
  onChange,
  greska,
  disabled,
  bezRegije,
  datum,
}: {
  idPolja: string;
  naziv: string;
  /** *Odlazak* / *Povratak*, or *Kuda* / *Odakle* on a one-way. */
  oznaka: string;
  /** Which arrow and which accent — the two legs are told apart by hue. */
  smer: Smer;
  katalog: Destinacija[];
  vrednost: Odabir;
  onChange: (odabir: Odabir) => void;
  greska?: string;
  disabled?: boolean;
  bezRegije?: boolean;
  /** The date field for this leg, rendered under the destination line. */
  datum?: ReactNode;
}) {
  const [otvoren, postaviOtvoren] = useState(false);
  const [nacrt, postaviNacrt] = useState<Odabir>(vrednost);

  function otvori() {
    postaviNacrt(vrednost);
    postaviOtvoren(true);
  }

  function potvrdi() {
    onChange(nacrt);
    postaviOtvoren(false);
  }

  const opis = opisOdabira(vrednost, katalog);
  const idGreske = `${idPolja}-greska`;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <SkrivenaPolja naziv={naziv} vrednost={vrednost} />

      <span
        aria-hidden="true"
        className={cn(
          "w-5 shrink-0 pt-5 text-center text-base leading-none",
          smer === "odlazak" ? "text-akcenat" : "text-povratak-akcenat",
        )}
      >
        {smer === "odlazak" ? "↑" : "↓"}
      </span>

      <div className="min-w-0 flex-1">
        <span className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {oznaka}
        </span>

        <button
          type="button"
          onClick={otvori}
          disabled={disabled}
          // Not `aria-invalid`: a button has no validity to report, so the
          // error is announced by association instead.
          aria-describedby={greska ? idGreske : undefined}
          className="flex min-h-11 w-full items-center gap-2 text-left"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[17px] font-semibold",
              opis === null && "font-normal text-muted-foreground",
            )}
          >
            {opis ?? T.forma.izaberi}
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>

        {datum}

        {greska ? (
          <p id={idGreske} role="alert" className="mt-1 text-sm text-destructive">
            {greska}
          </p>
        ) : null}
      </div>

      <Sheet open={otvoren} onOpenChange={postaviOtvoren}>
        <SheetContent side="bottom" className="max-h-[88svh] gap-0 rounded-t-2xl p-0">
          <span
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border"
          />
          <SheetHeader className="border-b border-border px-4 pt-2 pb-3">
            <SheetTitle className="text-base">{oznaka}</SheetTitle>
            <SheetDescription className="sr-only">
              {T.forma.izaberi}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <KaskadaDestinacija
              idPolja={idPolja}
              naziv={naziv}
              katalog={katalog}
              vrednost={nacrt}
              onChange={postaviNacrt}
              bezRegije={bezRegije}
              // The form outside this portal owns them; see the note up top.
              skrivenaPolja={false}
            />
          </div>

          <SheetFooter className="flex-row gap-3 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              onClick={() => postaviOtvoren(false)}
              className="h-12 flex-1 text-base"
            >
              {T.forma.odustani}
            </Button>
            <Button
              type="button"
              onClick={potvrdi}
              className="h-12 flex-1 bg-akcenat text-base text-na-akcentu hover:bg-akcenat/90"
            >
              {T.forma.potvrdi}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
