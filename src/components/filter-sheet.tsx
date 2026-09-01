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
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CvorDrzave, CvorRegije } from "@/domen/destinacije";
import {
  brojAktivnihFiltera,
  opsegZaCip,
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
  PoljeSortiranja,
  SmerSortiranja,
} from "@/domen/tipovi";
import { jeDatum, type Datum } from "@/lib/datum";
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
  const [otvoreneDrzave, postaviOtvoreneDrzave] = useState<string[]>([]);

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
   * uses, so typing a date and reloading the page agree.
   */
  function postaviKraj(kraj: "od" | "do", vrednost: string) {
    const drugi = kraj === "od" ? nacrt.opseg?.do : nacrt.opseg?.od;
    const ovaj = jeDatum(vrednost) ? vrednost : null;

    if (!ovaj) {
      postaviOpseg(drugi ? { od: drugi, do: drugi } : null);
      return;
    }
    if (!drugi) {
      postaviOpseg({ od: ovaj, do: ovaj });
      return;
    }
    const [od, doD] = kraj === "od" ? [ovaj, drugi] : [drugi, ovaj];
    postaviOpseg(od <= doD ? { od, do: doD } : { od: doD, do: od });
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
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base">{T.filter.naslov}</SheetTitle>
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
                      ? "border-primary bg-primary text-primary-foreground"
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

          <Odeljak naslov={T.sortiranje.naslov}>
            <div className="flex flex-col gap-2">
              <RedPrekidaca<PoljeSortiranja>
                vrednost={nacrt.sort.polje}
                opcije={[
                  { vrednost: "datum", naziv: T.sortiranje.poDatumu },
                  { vrednost: "destinacija", naziv: T.sortiranje.poDestinaciji },
                ]}
                onChange={(polje) =>
                  postaviNacrt((p) => ({ ...p, sort: { ...p.sort, polje } }))
                }
              />
              <RedPrekidaca<SmerSortiranja>
                vrednost={nacrt.sort.smer}
                opcije={[
                  { vrednost: "rastuce", naziv: T.sortiranje.rastuce },
                  { vrednost: "opadajuce", naziv: T.sortiranje.opadajuce },
                ]}
                onChange={(smer) =>
                  postaviNacrt((p) => ({ ...p, sort: { ...p.sort, smer } }))
                }
              />
            </div>
          </Odeljak>

          <Odeljak naslov={T.filter.destinacija}>
            <ul className="flex flex-col">
              {stablo.map((drzava) => {
                const otvorena = otvoreneDrzave.includes(drzava.kljuc);
                const panelId = `panel-${drzava.sifra}`;
                return (
                  <li
                    key={drzava.kljuc}
                    className="border-b border-border/60 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <RedIzbora
                        kljuc={drzava.kljuc}
                        naziv={drzava.naziv}
                        podebljano
                        pokriven={jePokriven(
                          gradoviCvora(stablo, drzava.kljuc),
                          izabraniGradovi,
                        )}
                        onToggle={prebaciDestinaciju}
                      />
                      <button
                        type="button"
                        aria-expanded={otvorena}
                        aria-controls={panelId}
                        aria-label={drzava.naziv}
                        onClick={() =>
                          postaviOtvoreneDrzave((p) =>
                            p.includes(drzava.kljuc)
                              ? p.filter((k) => k !== drzava.kljuc)
                              : [...p, drzava.kljuc],
                          )
                        }
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
                      >
                        <ChevronDownIcon
                          className={cn(
                            "size-5 transition-transform",
                            otvorena && "rotate-180",
                          )}
                        />
                      </button>
                    </div>

                    {otvorena ? (
                      <ul id={panelId} className="pb-1 pl-4">
                        {drzava.regije.map((regija) => (
                          <Regija
                            key={regija.kljuc}
                            regija={regija}
                            stablo={stablo}
                            izabraniGradovi={izabraniGradovi}
                            onToggle={prebaciDestinaciju}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
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
            className="h-12 flex-1 text-base"
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

function RedPrekidaca<V extends string>({
  vrednost,
  opcije,
  onChange,
}: {
  vrednost: V;
  opcije: readonly { vrednost: V; naziv: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcije.map((o) => (
        <button
          key={o.vrednost}
          type="button"
          onClick={() => onChange(o.vrednost)}
          aria-pressed={vrednost === o.vrednost}
          className={cn(
            "h-11 rounded-lg border px-3 text-base transition-colors",
            vrednost === o.vrednost
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background active:bg-muted",
          )}
        >
          {o.naziv}
        </button>
      ))}
    </div>
  );
}

/**
 * A region holding exactly one city renders as that city and nothing else —
 * showing `Solun i okolina` above `Solun` is two rows and two taps to say
 * Solun. The selection algebra treats the two keys as equivalent anyway.
 */
function Regija({
  regija,
  stablo,
  izabraniGradovi,
  onToggle,
}: {
  regija: CvorRegije;
  stablo: CvorDrzave[];
  izabraniGradovi: ReadonlySet<string>;
  onToggle: (kljuc: string) => void;
}) {
  if (regija.gradovi.length === 1) {
    const grad = regija.gradovi[0];
    return (
      <li>
        <RedIzbora
          kljuc={grad.kljuc}
          naziv={grad.naziv}
          pokriven={izabraniGradovi.has(grad.kljuc)}
          onToggle={onToggle}
        />
      </li>
    );
  }

  return (
    <li>
      <RedIzbora
        kljuc={regija.kljuc}
        naziv={regija.naziv}
        podebljano
        pokriven={jePokriven(
          gradoviCvora(stablo, regija.kljuc),
          izabraniGradovi,
        )}
        onToggle={onToggle}
      />
      <ul className="pl-4">
        {regija.gradovi.map((grad) => (
          <li key={grad.kljuc}>
            <RedIzbora
              kljuc={grad.kljuc}
              naziv={grad.naziv}
              pokriven={izabraniGradovi.has(grad.kljuc)}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Checkbox plus label, the pair sized as one 44px row. */
function RedIzbora({
  kljuc,
  naziv,
  pokriven,
  podebljano = false,
  onToggle,
}: {
  kljuc: string;
  naziv: string;
  pokriven: boolean;
  podebljano?: boolean;
  onToggle: (kljuc: string) => void;
}) {
  const id = `dest-${kljuc}`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Checkbox
        id={id}
        checked={pokriven}
        onCheckedChange={() => onToggle(kljuc)}
        className="size-5"
      />
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center truncate text-base",
          podebljano && "font-medium",
        )}
      >
        {naziv}
      </label>
    </div>
  );
}
