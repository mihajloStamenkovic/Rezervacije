"use client";

/**
 * Država → Regija → Grad, the three cascading dropdowns of SPEC §5.
 *
 * Two rules the screen has to get right, both of them in `promeni*` below:
 *
 * **Changing a level clears everything under it.** Pick a new country and the
 * region and city go blank. Leaving a stale region behind is how you end up
 * submitting Kasandra-in-Croatia.
 *
 * **A region with exactly one city auto-selects it and the third dropdown
 * disappears.** The rule, never the list: the client edits their own site, so
 * which regions are single-city changes when the data is re-seeded.
 *
 * The parent owns the destination id — that is what the form submits — while
 * this component owns the path taken to it, because a country picked with no
 * city yet is not a value the form can submit. The two are kept in one piece
 * of state carrying the id it was derived from, so when the id changes from
 * outside (the ⇅ swap, or the default home destination pre-filling) the path
 * is re-derived during render rather than in an effect. An effect would render
 * once with the stale country still showing.
 */
import { useState } from "react";
import { Izbor } from "@/components/izbor";
import { drzaveZaFormu, gradoviZaFormu, regijeZaFormu } from "@/domen/kaskada";
import type { Destinacija } from "@/domen/tipovi";
import { T } from "@/lib/tekst";

/** The path to a destination, plus the id it leads to — `null` while partial. */
type Put = { id: string | null; sifra: string; regija: string };

export function KaskadaDestinacija({
  idPolja,
  naziv,
  katalog,
  vrednost,
  onChange,
  greska,
}: {
  /** Prefix for the generated element ids — two cascades share one page. */
  idPolja: string;
  /** The `name` the destination id is submitted under. */
  naziv: string;
  katalog: Destinacija[];
  vrednost: string | null;
  onChange: (id: string | null) => void;
  greska?: string;
}) {
  const putZa = (id: string | null): Put => {
    const d = id ? (katalog.find((x) => x.id === id) ?? null) : null;
    return {
      id,
      sifra: d?.drzavaSifra ?? "",
      regija: d?.regija ?? "",
    };
  };

  const [put, postaviPut] = useState<Put>(() => putZa(vrednost));

  // The id moved without going through this component — re-derive the path.
  // Safe during render: it is a state adjustment on a prop change, and every
  // handler below writes `id` alongside the path, so this never fires on the
  // user's own half-finished selection.
  if (put.id !== vrednost) postaviPut(putZa(vrednost));

  const { sifra, regija } = put;

  const drzave = drzaveZaFormu(katalog);
  const regije = sifra ? regijeZaFormu(katalog, sifra) : [];
  const gradovi = sifra && regija ? gradoviZaFormu(katalog, sifra, regija) : [];

  // SPEC §5: exactly one city means no third dropdown at all.
  const jedanGrad = gradovi.length === 1;

  function promeniDrzavu(nova: string) {
    postaviPut({ id: null, sifra: nova, regija: "" });
    onChange(null);
  }

  function promeniRegiju(nova: string) {
    const gradoviNove = nova ? gradoviZaFormu(katalog, sifra, nova) : [];
    // Auto-select where there is no choice to make; otherwise clear, so the
    // previous region's city cannot survive into this one.
    const noviId = gradoviNove.length === 1 ? gradoviNove[0].id : null;
    postaviPut({ id: noviId, sifra, regija: nova });
    onChange(noviId);
  }

  function promeniGrad(id: string) {
    const noviId = id || null;
    postaviPut({ id: noviId, sifra, regija });
    onChange(noviId);
  }

  const idDrzave = `${idPolja}-drzava`;
  const idRegije = `${idPolja}-regija`;
  const idGrada = `${idPolja}-grad`;
  const idGreske = `${idPolja}-greska`;

  return (
    <div className="flex flex-col gap-3">
      {/* The id itself is what the form submits; the three selects are only
          the way to arrive at it. */}
      <input type="hidden" name={naziv} value={vrednost ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={idDrzave} className="text-sm font-medium">
          {T.forma.drzava}
        </label>
        <Izbor
          id={idDrzave}
          value={sifra}
          onChange={(e) => promeniDrzavu(e.target.value)}
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

      {sifra ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idRegije} className="text-sm font-medium">
            {T.forma.regija}
          </label>
          <Izbor
            id={idRegije}
            value={regija}
            onChange={(e) => promeniRegiju(e.target.value)}
          >
            <option value="">{T.forma.izaberi}</option>
            {regije.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Izbor>
        </div>
      ) : null}

      {regija && !jedanGrad ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idGrada} className="text-sm font-medium">
            {T.forma.grad}
          </label>
          <Izbor
            id={idGrada}
            value={vrednost ?? ""}
            onChange={(e) => promeniGrad(e.target.value)}
          >
            <option value="">{T.forma.izaberi}</option>
            {gradovi.map((g) => (
              <option key={g.id} value={g.id}>
                {g.naziv}
              </option>
            ))}
          </Izbor>
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
