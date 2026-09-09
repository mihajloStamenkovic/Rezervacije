"use client";

/**
 * Država → Regija → Grad, the cascading dropdowns of SPEC §5, plus the
 * *Drugo — upiši ručno* escape hatch added 06.09.2026.
 *
 * **The middle level is not always there.** It is dropped for the whole
 * *Povratak* leg (06.09.2026), and since 09.09.2026 it is dropped for any
 * country where it does not narrow the town list — Srbija first among them,
 * which is what the owner asked for. `bezRegijeZa` below is where the two
 * reasons meet; `drzavaTraziRegiju` is the rule itself.
 *
 * Three rules the screen has to get right, all of them in `promeni*` below:
 *
 * **Changing a level clears everything under it.** Pick a new country and the
 * region and city go blank. Leaving a stale region behind is how you end up
 * submitting Kasandra-in-Croatia.
 *
 * **A region with exactly one city auto-selects it.** The rule, never the
 * list: the client edits their own site, so which regions are single-city
 * changes when the data is re-seeded.
 *
 * **A place that is not in the list can be typed.** The region and city
 * dropdowns each end in *Drugo — upiši ručno*, which swaps that level for a
 * text box. The country is never typed: all seven are already in the table,
 * and a hand-spelled `Grcka` beside `Grčka` would split the destination
 * filter's one canonical list in two (standing rule 3). A typed region means a
 * typed city too — a region nobody has entered before has no towns to choose
 * from.
 *
 * The parent owns the *selection* — that is what the form submits — while this
 * component owns the path taken to it, because a country picked with no city
 * yet is not a value the form can submit. The two are kept in one piece of
 * state carrying the selection it was derived from, so when the selection
 * changes from outside (the ⇅ swap, or the default home destination
 * pre-filling) the path is re-derived during render rather than in an effect.
 * An effect would render once with the stale country still showing.
 */
import { useState } from "react";
import { Izbor } from "@/components/izbor";
import { Input } from "@/components/ui/input";
import {
  drzavaTraziRegiju,
  drzaveZaFormu,
  gradoviDrzaveZaFormu,
  gradoviZaFormu,
  kljucNaziva,
  regijeZaFormu,
  type NovoMesto,
} from "@/domen/kaskada";
import type { Destinacija } from "@/domen/tipovi";
import { T } from "@/lib/tekst";

/**
 * What one leg's cascade has arrived at: a destination id, or a place being
 * typed. Never both, and `{ id: null, novo: null }` while it is unfinished.
 */
export type Odabir = { id: string | null; novo: NovoMesto | null };

export const PRAZAN_ODABIR: Odabir = { id: null, novo: null };

/**
 * The `<option>` value that means "let me type it". Not a value any real
 * region name or destination id can take.
 */
const RUCNO = "__rucno__";

/** The path to a selection, plus the selection it leads to. */
type Put = {
  odabir: Odabir;
  sifra: string;
  /** The chosen or typed region name. */
  regija: string;
  rucnaRegija: boolean;
  rucniGrad: boolean;
  /** The typed city name. Empty unless `rucniGrad`. */
  grad: string;
};

/**
 * The four fields the Server Action reads, as one piece.
 *
 * Exported because they do not always sit where the cascade does: when the
 * cascade is opened in a Sheet, Radix portals it outside the `<form>` and
 * these have to stay behind in it — see `skrivenaPolja` and
 * `RedDestinacije`.
 */
export function SkrivenaPolja({
  naziv,
  vrednost,
}: {
  naziv: string;
  vrednost: Odabir;
}) {
  return (
    <>
      <input type="hidden" name={naziv} value={vrednost.id ?? ""} />
      <input
        type="hidden"
        name={`${naziv}Drzava`}
        value={vrednost.novo?.drzavaSifra ?? ""}
      />
      <input
        type="hidden"
        name={`${naziv}Regija`}
        value={vrednost.novo?.regija ?? ""}
      />
      <input
        type="hidden"
        name={`${naziv}Grad`}
        value={vrednost.novo?.grad ?? ""}
      />
    </>
  );
}

/** Value equality, so re-deriving fires on a real outside change only. */
function istiOdabir(a: Odabir, b: Odabir): boolean {
  if (a.id !== b.id) return false;
  if (a.novo === null || b.novo === null) return a.novo === b.novo;
  return (
    a.novo.drzavaSifra === b.novo.drzavaSifra &&
    a.novo.regija === b.novo.regija &&
    a.novo.grad === b.novo.grad
  );
}

export function KaskadaDestinacija({
  idPolja,
  naziv,
  katalog,
  vrednost,
  onChange,
  greska,
  disabled,
  bezRegije = false,
  skrivenaPolja = true,
}: {
  /** Prefix for the generated element ids — two cascades share one page. */
  idPolja: string;
  /**
   * The `name` the picked id is submitted under. A typed place travels beside
   * it as `${naziv}Drzava`, `${naziv}Regija` and `${naziv}Grad`.
   */
  naziv: string;
  katalog: Destinacija[];
  vrednost: Odabir;
  onChange: (odabir: Odabir) => void;
  greska?: string;
  disabled?: boolean;
  /**
   * Drop the middle level: Država → Grad, with every city of the country in
   * one list.
   *
   * The **Povratak** leg, at the owner's request (06.09.2026). The return end
   * is Beograd on about 99% of bookings, so asking which region Beograd is in
   * is a tap that buys nothing. Regions still exist in the data and still
   * matter on the outbound leg, where Hanioti versus Siviri is forty minutes
   * of driving. A town typed on this leg carries no region, and the Server
   * Action resolves that — see `razresiDestinaciju`.
   */
  bezRegije?: boolean;
  /**
   * Render the four hidden inputs the form submits.
   *
   * Off when the cascade lives inside a Sheet: Radix portals a sheet to the
   * end of `<body>`, which is outside the `<form>`, and an input outside the
   * form is an input the Server Action never receives. `RedDestinacije` keeps
   * them in the form and hands the cascade the value instead.
   */
  skrivenaPolja?: boolean;
}) {
  /**
   * Does *this* country show a region here?
   *
   * Two independent reasons not to, which is why this is a function of the
   * country rather than one flag: the leg may have no region field at all
   * (*Povratak*, 06.09.2026), or the country may not need one — Srbija,
   * Makedonija, Italija, BiH, Slovenija (09.09.2026). See
   * `drzavaTraziRegiju` for what "need" means and why it is a rule and not a
   * list of country names.
   *
   * It takes the country as an argument because the answer is asked about two
   * different ones: the country being *rendered*, and the country carried by a
   * selection arriving from outside.
   */
  const bezRegijeZa = (sifraDrzave: string) =>
    bezRegije || !drzavaTraziRegiju(katalog, sifraDrzave);

  const putZa = (odabir: Odabir): Put => {
    if (odabir.novo !== null) {
      const { drzavaSifra, regija, grad } = odabir.novo;
      // A typed region is one the catalogue does not have under this country.
      // Never on a leg with no region field — there is nothing to have typed.
      const poznata =
        regija === "" ||
        katalog.some(
          (d) =>
            d.drzavaSifra === drzavaSifra &&
            kljucNaziva(d.regija) === kljucNaziva(regija),
        );
      return {
        odabir,
        sifra: drzavaSifra,
        regija,
        rucnaRegija: !bezRegijeZa(drzavaSifra) && !poznata,
        rucniGrad: true,
        grad,
      };
    }

    const d = odabir.id
      ? (katalog.find((x) => x.id === odabir.id) ?? null)
      : null;
    return {
      odabir,
      sifra: d?.drzavaSifra ?? "",
      regija: d?.regija ?? "",
      rucnaRegija: false,
      rucniGrad: false,
      grad: "",
    };
  };

  const [put, postaviPut] = useState<Put>(() => putZa(vrednost));

  // The selection moved without going through this component — re-derive the
  // path. Safe during render: it is a state adjustment on a prop change, and
  // every handler below writes `odabir` alongside the path, so this never
  // fires on the user's own half-finished selection.
  if (!istiOdabir(put.odabir, vrednost)) postaviPut(putZa(vrednost));

  const { sifra, regija, rucnaRegija, rucniGrad, grad } = put;

  const drzave = drzaveZaFormu(katalog);
  const regije = sifra && !bezRegijeZa(sifra) ? regijeZaFormu(katalog, sifra) : [];
  const gradovi = !sifra
    ? []
    : bezRegijeZa(sifra)
      ? gradoviDrzaveZaFormu(katalog, sifra)
      : regija && !rucnaRegija
        ? gradoviZaFormu(katalog, sifra, regija)
        : [];

  /** What a half-typed place submits: the schema names the missing part. */
  function upisano(sledeci: Partial<Put>): Odabir {
    const p = { ...put, ...sledeci };
    return {
      id: null,
      novo: {
        drzavaSifra: p.sifra,
        /*
         * A leg with no region field never sends one, even though `put.regija`
         * still holds whatever the last picked town's region was. Sending it
         * would file a newly typed town under the region of the destination it
         * replaced — type `Novi Sad` over the pre-filled Beograd and it would
         * land in `Srbija › Beograd › Novi Sad`. Worse, it would stop the
         * server matching the town anywhere else in the country, which is the
         * whole point of leaving the region out.
         */
        regija: bezRegijeZa(p.sifra) ? "" : p.regija,
        grad: p.grad,
      },
    };
  }

  function primeni(sledeci: Partial<Put>, odabir: Odabir) {
    postaviPut({ ...put, ...sledeci, odabir });
    onChange(odabir);
  }

  function promeniDrzavu(nova: string) {
    // With no region level the city list is ready immediately, so the
    // auto-select rule applies here instead: a country holding exactly one
    // town needs no choosing.
    const gradoviNove =
      nova && bezRegijeZa(nova) ? gradoviDrzaveZaFormu(katalog, nova) : [];
    const noviId = gradoviNove.length === 1 ? gradoviNove[0].id : null;
    primeni(
      {
        sifra: nova,
        regija: "",
        rucnaRegija: false,
        rucniGrad: false,
        grad: "",
      },
      { id: noviId, novo: null },
    );
  }

  function promeniRegiju(izabrana: string) {
    if (izabrana === RUCNO) {
      // A region nobody has entered before has no cities to offer, so the
      // city is typed too — there is nothing else it could be.
      const sledeci = {
        regija: "",
        rucnaRegija: true,
        rucniGrad: true,
        grad: "",
      };
      primeni(sledeci, upisano(sledeci));
      return;
    }

    const gradoviNove = izabrana ? gradoviZaFormu(katalog, sifra, izabrana) : [];
    // Auto-select where there is no choice to make; otherwise clear, so the
    // previous region's city cannot survive into this one.
    const noviId = gradoviNove.length === 1 ? gradoviNove[0].id : null;
    primeni(
      {
        regija: izabrana,
        rucnaRegija: false,
        rucniGrad: false,
        grad: "",
      },
      { id: noviId, novo: null },
    );
  }

  function upisiRegiju(tekst: string) {
    primeni({ regija: tekst }, upisano({ regija: tekst }));
  }

  function promeniGrad(izabran: string) {
    if (izabran === RUCNO) {
      const sledeci = { rucniGrad: true, grad: "" };
      primeni(sledeci, upisano(sledeci));
      return;
    }
    primeni({ rucniGrad: false, grad: "" }, { id: izabran || null, novo: null });
  }

  function upisiGrad(tekst: string) {
    primeni({ grad: tekst }, upisano({ grad: tekst }));
  }

  /**
   * With a region level, the city list waits for a region. Without one, the
   * country is enough.
   */
  const prikaziGrad = bezRegijeZa(sifra)
    ? Boolean(sifra)
    : rucnaRegija || Boolean(regija);

  const idDrzave = `${idPolja}-drzava`;
  const idRegije = `${idPolja}-regija`;
  const idGrada = `${idPolja}-grad`;
  const idGreske = `${idPolja}-greska`;

  return (
    <div className="flex flex-col gap-3">
      {/*
        What the form submits. The id when a destination was picked; the
        country, region and city when one was typed. All four are rendered
        every time so a field never disappears mid-edit — the Server Action
        reads an empty id plus a filled-in name as "create this place".
      */}
      {skrivenaPolja ? <SkrivenaPolja naziv={naziv} vrednost={vrednost} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={idDrzave} className="text-sm font-medium">
          {T.forma.drzava}
        </label>
        <Izbor
          id={idDrzave}
          value={sifra}
          onChange={(e) => promeniDrzavu(e.target.value)}
          disabled={disabled}
          aria-invalid={greska ? true : undefined}
          aria-describedby={greska ? idGreske : undefined}
        >
          <option value="">{T.forma.izaberi}</option>
          {drzave.map((d) => (
            <option key={d.sifra} value={d.sifra}>
              {d.naziv}
            </option>
          ))}
        </Izbor>
      </div>

      {sifra && !bezRegijeZa(sifra) ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idRegije} className="text-sm font-medium">
            {T.forma.regija}
          </label>
          <Izbor
            id={idRegije}
            value={rucnaRegija ? RUCNO : regija}
            onChange={(e) => promeniRegiju(e.target.value)}
            disabled={disabled}
          >
            <option value="">{T.forma.izaberi}</option>
            {regije.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={RUCNO}>{T.forma.drugoRucno}</option>
          </Izbor>
          {rucnaRegija ? (
            <Input
              aria-label={T.forma.nazivRegije}
              value={regija}
              onChange={(e) => upisiRegiju(e.target.value)}
              placeholder={T.forma.nazivRegijeOpciono}
              disabled={disabled}
              className="h-11 text-base md:text-base"
            />
          ) : null}
        </div>
      ) : null}

      {/*
        The third level shows as soon as a region exists, single-city or not.
        SPEC §5 had it hidden when a region held exactly one city — one option
        is not a choice — but that stopped being true once the list ends in
        *Drugo — upiši ručno*, and hiding the dropdown would hide the only way
        to enter the town that is missing from it. The auto-select survives:
        the single city is already chosen, so it still costs no taps.
      */}
      {prikaziGrad ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idGrada} className="text-sm font-medium">
            {T.forma.grad}
          </label>
          {rucnaRegija ? null : (
            <Izbor
              id={idGrada}
              value={rucniGrad ? RUCNO : (vrednost.id ?? "")}
              onChange={(e) => promeniGrad(e.target.value)}
              disabled={disabled}
            >
              <option value="">{T.forma.izaberi}</option>
              {gradovi.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.naziv}
                </option>
              ))}
              <option value={RUCNO}>{T.forma.drugoRucno}</option>
            </Izbor>
          )}
          {rucniGrad ? (
            <>
              <Input
                id={rucnaRegija ? idGrada : undefined}
                aria-label={T.forma.nazivMesta}
                value={grad}
                onChange={(e) => upisiGrad(e.target.value)}
                placeholder={T.forma.nazivMestaPlaceholder}
                disabled={disabled}
                className="h-11 text-base md:text-base"
              />
              <p className="text-sm text-muted-foreground">
                {T.forma.nazivMestaPomoc}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {greska ? (
        <p id={idGreske} role="alert" className="text-sm text-destructive">
          {greska}
        </p>
      ) : null}
    </div>
  );
}
