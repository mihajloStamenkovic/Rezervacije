"use client";

/**
 * The filter bottom sheet — SPEC §3 and §6, screen 2.
 *
 * Two things about how it holds state.
 *
 * **It edits a draft, not the list.** Everything typed and ticked here goes
 * into local state and only reaches the URL on *Primeni*. On a phone the sheet
 * covers the list, so live-applying would re-render something the user cannot
 * see, once per tap, over a mobile connection.
 *
 * **The applied state still lives in the URL.** The draft is seeded from it
 * every time the sheet opens, so closing without applying discards cleanly and
 * the back button steps through filter changes rather than sheet openings.
 *
 * No filtering happens in this file. Ticking a box calls `prebaciCvor` in the
 * domain core, the badge count is `brojAktivnihFiltera`, and the chip ranges
 * are `opsegZaCip`. This component decides layout and nothing else.
 *
 * **There was a *Sortiranje* section here until 09.09.2026**, offering date or
 * destination and ascending or descending. The owner asked for it to go. The
 * list has one order now — by date, soonest first — so the sheet holds only
 * the two things that are genuinely questions: which days, and which places.
 */
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CvorDrzave } from "@/domen/destinacije";
import {
  brojAktivnihFiltera,
  opsegZaCip,
  postaviKrajOpsega,
  type CipDatuma,
} from "@/domen/filteri";
import {
  gradoviCvora,
  jePokriven,
  prebaciCvor,
  razviIzbor,
} from "@/domen/izbor-destinacija";
import type {
  OpsegDatuma,
} from "@/domen/tipovi";
import type { Datum } from "@/lib/datum";
import { T, filtera } from "@/lib/tekst";
import {
  PRAZNO_STANJE,
  aktivanCip,
  putanjaListe,
  type StanjeUrl,
} from "@/lib/url-stanje";
import { cn } from "@/lib/utils";

const CIPOVI: readonly { cip: CipDatuma; naziv: string }[] = [
  { cip: "danas", naziv: T.filter.danas },
  { cip: "ovaNedelja", naziv: T.filter.ovaNedelja },
  { cip: "ovajMesec", naziv: T.filter.ovajMesec },
];

export function FilterSheet({
  stablo,
  stanje,
  danas,
}: {
  stablo: CvorDrzave[];
  stanje: StanjeUrl;
  danas: Datum;
}) {
  const router = useRouter();
  const [otvoren, postaviOtvoren] = useState(false);
  const [nacrt, postaviNacrt] = useState<StanjeUrl>(stanje);
  const [beseOtvoren, postaviBeseOtvoren] = useState(false);
  // Which regions are showing their towns. Never applied, never in the URL —
  // it is where you are looking, not what you are filtering on.
  const [otvoreneRegije, postaviOtvoreneRegije] = useState<string[]>([]);

  // Reseed the draft from the applied state each time the sheet opens, so a
  // sheet closed with the X leaves no half-made changes behind. Done as a
  // state adjustment on the closed-to-open transition rather than in an
  // effect, which would paint the stale draft for one frame first.
  if (otvoren !== beseOtvoren) {
    postaviBeseOtvoren(otvoren);
    if (otvoren) postaviNacrt(stanje);
  }

  const izabraniGradovi = useMemo(
    () => razviIzbor(stablo, nacrt.destinacije),
    [stablo, nacrt.destinacije],
  );

  const broj = brojAktivnihFiltera(stanje);
  const brojNacrta = brojAktivnihFiltera(nacrt);
  const cip = aktivanCip(nacrt.opseg, danas);

  function postaviOpseg(opseg: OpsegDatuma | null) {
    postaviNacrt((p) => ({ ...p, opseg }));
  }

  /** A chip already on is a chip that turns the date filter off again. */
  function prebaciCip(izabrani: CipDatuma) {
    postaviOpseg(cip === izabrani ? null : opsegZaCip(izabrani, danas));
  }

  /**
   * The custom range. Either end may be cleared, and an incomplete range is
   * read as the single day still filled in — the same rule the URL parser
   * uses, so typing a date and reloading the page agree. The rule itself lives
   * in `postaviKrajOpsega` so it can be tested without rendering the sheet.
   */
  function postaviKraj(kraj: "od" | "do", vrednost: string) {
    postaviOpseg(postaviKrajOpsega(nacrt.opseg, kraj, vrednost));
  }

  function prebaciOtvorenu(kljuc: string) {
    postaviOtvoreneRegije((p) =>
      p.includes(kljuc) ? p.filter((k) => k !== kljuc) : [...p, kljuc],
    );
  }

  function prebaciDestinaciju(kljuc: string) {
    postaviNacrt((p) => ({
      ...p,
      destinacije: prebaciCvor(stablo, p.destinacije, kljuc),
    }));
  }

  function primeni() {
    postaviOtvoren(false);
    router.push(putanjaListe(nacrt));
  }

  function obrisiSve() {
    // Search is its own control in the header and is not a filter — clearing
    // filters must not silently discard what the user typed there.
    postaviNacrt((p) => ({ ...PRAZNO_STANJE, pretraga: p.pretraga }));
  }

  return (
    <Sheet open={otvoren} onOpenChange={postaviOtvoren}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="relative h-11 gap-2 px-3 text-base"
        >
          <SlidersHorizontalIcon className="size-4" />
          <span>{T.filter.dugme}</span>
          {broj > 0 ? (
            <span
              className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground"
              aria-label={filtera(broj)}
            >
              {broj}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        // Capped below the viewport so the list stays visible behind it and
        // the body scrolls rather than the sheet growing off-screen.
        className="max-h-[88svh] gap-0 rounded-t-2xl p-0"
      >
        {/* The grab handle. Decoration in the strictest sense — the sheet is
            dismissed by the ✕, the overlay or Escape — but it is the mark that
            says "this slid up from the bottom", and the canvas draws it. */}
        <span
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border"
        />

        <SheetHeader className="flex-row items-center gap-2 border-b border-border px-4 pt-2 pb-3">
          <SheetTitle className="text-base">{T.filter.naslov}</SheetTitle>
          {/* The *draft's* count, not the applied one the trigger shows: in
              here the number has to move as boxes are ticked, or it reads as
              broken. */}
          {brojNacrta > 0 ? (
            <span
              aria-label={filtera(brojNacrta)}
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-akcenat px-1.5 py-0.5 text-xs font-semibold text-na-akcentu"
            >
              {brojNacrta}
            </span>
          ) : null}
          <SheetDescription className="sr-only">
            {T.filter.naslov}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <Odeljak naslov={T.filter.datum}>
            <div className="flex flex-wrap gap-2">
              {CIPOVI.map(({ cip: c, naziv }) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => prebaciCip(c)}
                  aria-pressed={cip === c}
                  className={cn(
                    "h-11 rounded-full border px-4 text-base transition-colors",
                    cip === c
                      ? "border-akcenat bg-akcenat text-na-akcentu"
                      : "border-border bg-background active:bg-muted",
                  )}
                >
                  {naziv}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <PoljeDatuma
                id="filter-od"
                oznaka={T.filter.odDatuma}
                vrednost={nacrt.opseg?.od ?? ""}
                onChange={(v) => postaviKraj("od", v)}
              />
              <PoljeDatuma
                id="filter-do"
                oznaka={T.filter.doDatuma}
                vrednost={nacrt.opseg?.do ?? ""}
                onChange={(v) => postaviKraj("do", v)}
              />
            </div>
          </Odeljak>

          <Odeljak naslov={T.filter.destinacija}>
            <div className="flex flex-col gap-4">
              {stablo.map((drzava) => (
                <GrupaDrzave
                  key={drzava.kljuc}
                  drzava={drzava}
                  stablo={stablo}
                  izabraniGradovi={izabraniGradovi}
                  otvorene={otvoreneRegije}
                  onOtvori={prebaciOtvorenu}
                  onToggle={prebaciDestinaciju}
                />
              ))}
            </div>
          </Odeljak>
        </div>

        <SheetFooter
          // The two primary actions sit in the bottom third, clear of the home
          // indicator on a notched phone.
          className="flex-row gap-3 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <Button
            type="button"
            variant="outline"
            onClick={obrisiSve}
            className="h-12 flex-1 text-base"
          >
            {T.filter.obrisiSve}
          </Button>
          <Button
            type="button"
            onClick={primeni}
            className="h-12 flex-1 bg-akcenat text-base text-na-akcentu hover:bg-akcenat/90"
          >
            {T.filter.primeni}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Odeljak({
  naslov,
  children,
}: {
  naslov: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {naslov}
      </h3>
      {children}
    </section>
  );
}

function PoljeDatuma({
  id,
  oznaka,
  vrednost,
  onChange,
}: {
  id: string;
  oznaka: string;
  vrednost: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {oznaka}
      </label>
      {/* Native date input: the phone's own picker beats anything hand-rolled,
          and it speaks YYYY-MM-DD, which is what the rest of the app uses. */}
      <Input
        id={id}
        type="date"
        value={vrednost}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base md:text-base"
      />
    </div>
  );
}

/**
 * One country as a row of chips: the country itself, then what sits under it.
 *
 * **A region holding exactly one city renders as that city** — showing
 * `Solun i okolina` beside `Solun` is two chips to say Solun, and the
 * selection algebra treats the two keys as equivalent anyway. That single rule
 * is what makes Srbija read as `Beograd · Kopaonik · Niš` while Grčka reads as
 * its four regions, with no country named anywhere in this file.
 *
 * A real region keeps its towns one tap away rather than on screen: 45 towns
 * laid out at once is a wall, and the towns of a region you are not filtering
 * on are noise. The chevron inside the chip opens them; the chip itself still
 * selects the whole region, which is the common case.
 */
function GrupaDrzave({
  drzava,
  stablo,
  izabraniGradovi,
  otvorene,
  onOtvori,
  onToggle,
}: {
  drzava: CvorDrzave;
  stablo: CvorDrzave[];
  izabraniGradovi: ReadonlySet<string>;
  otvorene: string[];
  onOtvori: (kljuc: string) => void;
  onToggle: (kljuc: string) => void;
}) {
  const stanje = (kljuc: string, roditeljPun: boolean): StanjeCipa => {
    const gradovi = gradoviCvora(stablo, kljuc);
    if (jePokriven(gradovi, izabraniGradovi)) {
      // Ticked in its own right, or merely swept up by its country. The
      // difference is the whole reason for the soft state: a filled chip is
      // something you chose, a soft one is something you are getting.
      return roditeljPun ? "blag" : "pun";
    }
    return gradovi.some((g) => izabraniGradovi.has(g)) ? "blag" : "prazan";
  };

  const drzavaPuna = stanje(drzava.kljuc, false) === "pun";

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Cip
        naziv={drzava.naziv}
        stanje={drzavaPuna ? "pun" : "prazan"}
        podebljano
        onClick={() => onToggle(drzava.kljuc)}
      />

      {drzava.regije.map((regija) => {
        if (regija.gradovi.length === 1) {
          const grad = regija.gradovi[0];
          return (
            <Cip
              key={grad.kljuc}
              naziv={grad.naziv}
              stanje={stanje(grad.kljuc, drzavaPuna)}
              onClick={() => onToggle(grad.kljuc)}
            />
          );
        }

        const otvorena = otvorene.includes(regija.kljuc);
        const regijaPuna = stanje(regija.kljuc, drzavaPuna) === "pun";
        return (
          <Fragment key={regija.kljuc}>
            <Cip
              naziv={regija.naziv}
              stanje={stanje(regija.kljuc, drzavaPuna)}
              otvorena={otvorena}
              onOtvori={() => onOtvori(regija.kljuc)}
              onClick={() => onToggle(regija.kljuc)}
            />
            {otvorena ? (
              // Its own full-width line, so opening a region never reshuffles
              // the chips beside it — a list that rearranges under the thumb
              // is a list you tap the wrong thing in.
              <div className="flex w-full flex-wrap gap-2 pl-4">
                {regija.gradovi.map((grad) => (
                  <Cip
                    key={grad.kljuc}
                    naziv={grad.naziv}
                    stanje={stanje(grad.kljuc, drzavaPuna || regijaPuna)}
                    onClick={() => onToggle(grad.kljuc)}
                  />
                ))}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * Filled when you chose it, soft when something under or over it is chosen,
 * plain otherwise.
 */
type StanjeCipa = "pun" | "blag" | "prazan";

function Cip({
  naziv,
  stanje,
  podebljano = false,
  otvorena,
  onOtvori,
  onClick,
}: {
  naziv: string;
  stanje: StanjeCipa;
  podebljano?: boolean;
  /** Present only on a chip that has towns to open. */
  otvorena?: boolean;
  onOtvori?: () => void;
  onClick: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-11 items-center rounded-full border transition-colors",
        stanje === "pun" &&
          "border-akcenat bg-akcenat text-na-akcentu",
        stanje === "blag" &&
          "border-akcenat-ivica bg-akcenat-blago text-akcenat-slova",
        stanje === "prazan" && "border-border bg-background",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={stanje === "pun"}
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-full px-4 text-base",
          podebljano && "font-medium",
          onOtvori && "pr-2",
        )}
      >
        {stanje === "pun" ? (
          <CheckIcon aria-hidden="true" className="size-4" />
        ) : null}
        {naziv}
      </button>
      {onOtvori ? (
        <button
          type="button"
          onClick={onOtvori}
          aria-expanded={otvorena}
          aria-label={naziv}
          className="flex h-11 w-9 items-center justify-center rounded-r-full"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              otvorena && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </span>
  );
}
