/**
 * The list screen's whole state, carried in the URL.
 *
 * Filter, sort and search live in the query string rather than in React
 * state, and that is a deliberate choice with three consequences worth having:
 * the list page stays a Server Component that reads `searchParams` and renders
 * once; a filtered view is linkable and survives a reload; and the back button
 * steps through filter changes the way a phone user expects.
 *
 * Nothing here reads a clock. `danas` is always passed in — the chip ranges
 * are computed from Belgrade's today at the edge (SPEC §7).
 *
 * Every parser in this file is deliberately forgiving. Filter state travels
 * through a URL that anyone can hand-edit or that can go stale across a
 * re-seed, and a bad parameter must degrade to "that filter is off" rather
 * than throw — an unfiltered list is recoverable, an error page is not.
 */
import { opsegZaCip, type CipDatuma } from "@/domen/filteri";
import { PODRAZUMEVANO_SORTIRANJE } from "@/domen/sortiranje";
import type {
  OpsegDatuma,
  PoljeSortiranja,
  SmerSortiranja,
  Sortiranje,
} from "@/domen/tipovi";
import { jeDatum, type Datum } from "@/lib/datum";

/** What `searchParams` hands a page in Next 16. */
export type UlazniParametri = Record<string, string | string[] | undefined>;

export type StanjeUrl = {
  opseg: OpsegDatuma | null;
  /** Destination filter keys — `drzava:`, `regija:` or `grad:` prefixed. */
  destinacije: string[];
  pretraga: string;
  sort: Sortiranje;
};

export const PRAZNO_STANJE: StanjeUrl = {
  opseg: null,
  destinacije: [],
  pretraga: "",
  sort: PODRAZUMEVANO_SORTIRANJE,
};

/** Parameter names, in one place so the reader and the writer cannot drift. */
export const P = {
  od: "od",
  do: "do",
  destinacija: "d",
  pretraga: "q",
  polje: "sort",
  smer: "smer",
} as const;

function prvi(vrednost: string | string[] | undefined): string | undefined {
  return Array.isArray(vrednost) ? vrednost[0] : vrednost;
}

function sve(vrednost: string | string[] | undefined): string[] {
  if (vrednost === undefined) return [];
  return Array.isArray(vrednost) ? vrednost : [vrednost];
}

function datumIli(
  vrednost: string | string[] | undefined,
): Datum | null {
  const v = prvi(vrednost);
  return v !== undefined && jeDatum(v) ? v : null;
}

/**
 * Reads the state out of a query string.
 *
 * A half-filled range (`od` with no `do`, or the reverse) is read as the
 * single day that was given, not as "no filter": a user who picked one date
 * asked a question about one day, and `opsegZaDan` is exactly that shape.
 */
export function procitajStanjeUrl(parametri: UlazniParametri): StanjeUrl {
  const od = datumIli(parametri[P.od]);
  const doDatuma = datumIli(parametri[P.do]);

  let opseg: OpsegDatuma | null = null;
  if (od && doDatuma) opseg = od <= doDatuma ? { od, do: doDatuma } : { od: doDatuma, do: od };
  else if (od) opseg = { od, do: od };
  else if (doDatuma) opseg = { od: doDatuma, do: doDatuma };

  const polje = prvi(parametri[P.polje]);
  const smer = prvi(parametri[P.smer]);

  return {
    opseg,
    // Deduplicated: a repeated key would otherwise inflate the filter badge.
    destinacije: [...new Set(sve(parametri[P.destinacija]).filter((k) => k !== ""))],
    pretraga: (prvi(parametri[P.pretraga]) ?? "").trim(),
    sort: {
      polje: jePolje(polje) ? polje : PODRAZUMEVANO_SORTIRANJE.polje,
      smer: jeSmer(smer) ? smer : PODRAZUMEVANO_SORTIRANJE.smer,
    },
  };
}

function jePolje(v: string | undefined): v is PoljeSortiranja {
  return v === "datum" || v === "destinacija";
}

function jeSmer(v: string | undefined): v is SmerSortiranja {
  return v === "rastuce" || v === "opadajuce";
}

/**
 * Serialises back to a query string, omitting anything at its default.
 *
 * Short URLs are not cosmetic here: this string is what the back button
 * remembers and what gets pasted into a message between the two accounts.
 */
export function upitZaStanje(stanje: StanjeUrl): string {
  const p = new URLSearchParams();

  if (stanje.opseg) {
    p.set(P.od, stanje.opseg.od);
    // A single day is written as one parameter, so `?od=2026-01-01` is the
    // shortest form of the commonest filter.
    if (stanje.opseg.do !== stanje.opseg.od) p.set(P.do, stanje.opseg.do);
  }
  for (const kljuc of stanje.destinacije) p.append(P.destinacija, kljuc);
  if (stanje.pretraga.trim() !== "") p.set(P.pretraga, stanje.pretraga.trim());
  if (stanje.sort.polje !== PODRAZUMEVANO_SORTIRANJE.polje) {
    p.set(P.polje, stanje.sort.polje);
  }
  if (stanje.sort.smer !== PODRAZUMEVANO_SORTIRANJE.smer) {
    p.set(P.smer, stanje.sort.smer);
  }

  const upit = p.toString();
  return upit === "" ? "" : `?${upit}`;
}

/** `/` plus the current filters — what every link back to the list uses. */
export function putanjaListe(stanje: StanjeUrl): string {
  return `/${upitZaStanje(stanje)}`;
}

const CIPOVI: readonly CipDatuma[] = ["danas", "ovaNedelja", "ovajMesec"];

/**
 * Which quick chip, if any, the current range corresponds to — so the sheet
 * can show it pressed. Compared by value rather than stored as a fourth
 * parameter: a chip is only ever shorthand for a range, and storing both
 * would let them disagree after midnight in Belgrade.
 */
export function aktivanCip(
  opseg: OpsegDatuma | null,
  danas: Datum,
): CipDatuma | null {
  if (!opseg) return null;
  for (const cip of CIPOVI) {
    const o = opsegZaCip(cip, danas);
    if (o.od === opseg.od && o.do === opseg.do) return cip;
  }
  return null;
}
