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
import { useRef, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import {
  KaskadaDestinacija,
  SkrivenaPolja,
  type Odabir,
} from "@/components/kaskada-destinacija";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDatum, type Datum } from "@/lib/datum";
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
  onChangeDatuma,
  greska,
  disabled,
  bezRegije,
  datum,
  imeDatuma,
  samofokus = true,
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
  onChangeDatuma: (datum: string) => void;
  greska?: string;
  disabled?: boolean;
  bezRegije?: boolean;
  /**
   * This leg's date — asked **in the same sheet**, not on the form.
   *
   * The owner's correction, 09.09.2026: "I want the date to be entered at the
   * same time as the country, region, city." He is right, and the canvas
   * agrees — it draws the date as plain text under the route, which only makes
   * sense if it is filled in wherever the destination is. So the row *reads*
   * the date and the sheet *asks* for it.
   *
   * `null` when there is no date to ask for: the return leg of a one-way.
   */
  datum: {
    vrednost: string;
    oznaka: string;
    /** A return can be no earlier than its departure. */
    min?: string;
    greska?: string;
  } | null;
  /** The field name the date is submitted under — `datumPolaska` and friend. */
  imeDatuma: string;
  /**
   * Put the cursor in the first field when the sheet opens.
   *
   * On by default, and **off for the return leg** at the owner's request,
   * 09.09.2026: "when I click Povratak I want the window to just open". A
   * dialog normally focuses its first control, which is the right thing when
   * the sheet is a blank form to fill — the outbound leg — and the wrong thing
   * when it is not. The return is pre-filled with Beograd on nearly every
   * booking, so opening it usually means going for the date, and being dropped
   * into the country picker is a field lighting up that he did not ask for.
   *
   * Focus still moves *into* the sheet, onto the panel itself, so the trap
   * holds and a keyboard or screen reader is not left behind on the trigger.
   */
  samofokus?: boolean;
}) {
  const sadrzaj = useRef<HTMLDivElement>(null);
  const [otvoren, postaviOtvoren] = useState(false);
  const [nacrt, postaviNacrt] = useState<Odabir>(vrednost);
  const [nacrtDatuma, postaviNacrtDatuma] = useState(datum?.vrednost ?? "");

  function otvori() {
    // Both drafts seeded together, because Potvrdi commits them together.
    postaviNacrt(vrednost);
    postaviNacrtDatuma(datum?.vrednost ?? "");
    postaviOtvoren(true);
  }

  function potvrdi() {
    onChange(nacrt);
    if (datum) onChangeDatuma(nacrtDatuma);
    postaviOtvoren(false);
  }

  const opis = opisOdabira(vrednost, katalog);
  const idGreske = `${idPolja}-greska`;
  const idDatuma = `${idPolja}-datum`;

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

        {/* Read here, asked in the sheet. The hidden input is what the form
            actually submits — the sheet's own field is portalled outside it. */}
        {datum ? (
          <>
            <input type="hidden" name={imeDatuma} value={datum.vrednost} />
            <button
              type="button"
              onClick={otvori}
              disabled={disabled}
              className="flex min-h-9 w-full items-center text-left text-base text-muted-foreground"
            >
              {datum.vrednost === ""
                ? datum.oznaka
                : formatDatum(datum.vrednost as Datum)}
            </button>
          </>
        ) : null}

        {greska ? (
          <p id={idGreske} role="alert" className="mt-1 text-sm text-destructive">
            {greska}
          </p>
        ) : null}
        {datum?.greska ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {datum.greska}
          </p>
        ) : null}
      </div>

      <Sheet open={otvoren} onOpenChange={postaviOtvoren}>
        <SheetContent
          ref={sadrzaj}
          side="bottom"
          className="max-h-[88svh] gap-0 rounded-t-2xl p-0"
          onOpenAutoFocus={
            samofokus
              ? undefined
              : (e) => {
                  // Not "focus nothing" — focus the panel. Cancelling Radix's
                  // own focus without putting it somewhere would leave it on
                  // the row behind the sheet, outside the trap.
                  e.preventDefault();
                  sadrzaj.current?.focus();
                }
          }
        >
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

            {/* The date, in the same sheet and the same breath as the place —
                and with no `name`, because it is a draft until Potvrdi and it
                is portalled outside the form anyway. */}
            {datum ? (
              <div className="mt-3 flex flex-col gap-1.5">
                <label htmlFor={idDatuma} className="text-sm font-medium">
                  {datum.oznaka}
                </label>
                <Input
                  id={idDatuma}
                  type="date"
                  value={nacrtDatuma}
                  min={datum.min}
                  onChange={(e) => postaviNacrtDatuma(e.target.value)}
                  className="h-11 text-base md:text-base"
                />
              </div>
            ) : null}
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
