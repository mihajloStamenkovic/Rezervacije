/**
 * The list modes — SPEC §2.
 *
 * A date filter is a question about a **day**, not about a booking, so the
 * list is a genuinely different shape depending on whether one is active:
 *
 *   **Raspored** (no date filter) — one row *per reservation*, its main leg,
 *   from today forward. Answers "what is coming up".
 *
 *   **Dan** (date filter active) — one row *per leg* falling inside the range,
 *   departures before returns. A same-day round trip produces two rows.
 *   Answers "what happens on 01.01.2026".
 *
 *   **Pretraga** (search, no date filter) — one row per matching reservation,
 *   ignoring the horizon, because search is the only way to reach a booking
 *   with no main date.
 *
 * Three separate functions on purpose. One function with a mode flag would be
 * shorter and would get one of the shapes subtly wrong.
 */
import { destinacijeIzRedova, razresiDestinacije } from "./destinacije";
import {
  normalizujOpseg,
  prolaziDestinacije,
  rezimPrikaza,
  uOpsegu,
} from "./filteri";
import {
  etapaPolaska,
  proveriDanas,
  resolveMainLeg,
  sveEtape,
} from "./glavna-etapa";
import { pripremiUpit, prolaziPretragu } from "./pretraga";
import { sortirajStavke } from "./sortiranje";
import type {
  Datum,
  Destinacija,
  Etapa,
  OpsegDatuma,
  RezervacijaRed,
  RezimPrikaza,
  Sortiranje,
  StanjeListe,
  StavkaListe,
} from "./tipovi";

/** Options shared by every mode. */
export type OpcijeListe = {
  danas: Datum;
  destinacije?: readonly string[];
  pretraga?: string | null;
  sort?: Sortiranje;
  katalog?: readonly Destinacija[];
};

/** Dan mode additionally needs the range — that is what defines it. */
export type OpcijeDana = OpcijeListe & { opseg: OpsegDatuma };

function stavka(red: RezervacijaRed, etapa: Etapa): StavkaListe {
  return {
    ...etapa,
    red,
    kljuc: `${red.rezervacija.id}#${etapa.smer}`,
  };
}

/**
 * The rollup is resolved against the reference table when one is supplied.
 *
 * Without one it falls back to the destinations carried by the rows, which
 * gives identical matches — a leg can only point at a destination that is
 * already in front of us — while sparing every caller from threading all 44
 * reference rows through just to tick one checkbox.
 */
function dozvoljeneDestinacije(
  opcije: OpcijeListe,
  redovi: readonly RezervacijaRed[],
): ReadonlySet<string> | null {
  const kljucevi = opcije.destinacije;
  if (!kljucevi || kljucevi.length === 0) return null;
  return razresiDestinacije(
    kljucevi,
    opcije.katalog ?? destinacijeIzRedova(redovi),
  );
}

/**
 * **Raspored** — the default list. One row per reservation, showing its main
 * leg, from today forward, sorted by main date ascending.
 *
 * Two exclusions, both from SPEC §1:
 *   - no main leg at all (departed, no return date) — not here;
 *   - a main date already in the past (departed *and* returned) — not here,
 *     because this list is "what is coming up".
 */
export function rasporedView(
  redovi: readonly RezervacijaRed[],
  opcije: OpcijeListe,
): StavkaListe[] {
  const danas = proveriDanas(opcije.danas);
  const dozvoljene = dozvoljeneDestinacije(opcije, redovi);
  const upit = pripremiUpit(opcije.pretraga);

  const stavke: StavkaListe[] = [];
  for (const red of redovi) {
    const glavna = resolveMainLeg(red, danas);
    if (glavna === null) continue;
    if (glavna.datum < danas) continue;
    if (!prolaziPretragu(red, upit)) continue;

    const s = stavka(red, glavna);
    if (!prolaziDestinacije(s, dozvoljene)) continue;
    stavke.push(s);
  }

  return sortirajStavke(stavke, opcije.sort);
}

/**
 * **Dan** — every leg falling inside the chosen date or range, departures
 * before returns.
 *
 * The main leg rule does not apply here and neither does the "from today
 * forward" horizon: the question is about a day, and that day may be in the
 * past. This is the second half of the SPEC §1 edge case — a booking that
 * departed with no return date is reachable "by search on the name, **or by
 * filtering its past departure date**".
 */
export function danView(
  redovi: readonly RezervacijaRed[],
  opcije: OpcijeDana,
): StavkaListe[] {
  proveriDanas(opcije.danas);
  const opseg = normalizujOpseg(opcije.opseg);
  const dozvoljene = dozvoljeneDestinacije(opcije, redovi);
  const upit = pripremiUpit(opcije.pretraga);

  const stavke: StavkaListe[] = [];
  for (const red of redovi) {
    if (!prolaziPretragu(red, upit)) continue;
    for (const etapa of sveEtape(red)) {
      if (!uOpsegu(etapa.datum, opseg)) continue;
      const s = stavka(red, etapa);
      if (!prolaziDestinacije(s, dozvoljene)) continue;
      stavke.push(s);
    }
  }

  return sortirajStavke(stavke, opcije.sort);
}

/**
 * **Pretraga** — one row per matching reservation, with no date horizon.
 *
 * Each match shows its main leg where it has one. Where it has none — departed
 * with no return date — it shows its departure leg instead, which is the only
 * thing about that booking there is to show. Without this the one booking
 * search exists to rescue would match and then render as nothing.
 */
export function pretragaView(
  redovi: readonly RezervacijaRed[],
  opcije: OpcijeListe,
): StavkaListe[] {
  const danas = proveriDanas(opcije.danas);
  const dozvoljene = dozvoljeneDestinacije(opcije, redovi);
  const upit = pripremiUpit(opcije.pretraga);

  const stavke: StavkaListe[] = [];
  for (const red of redovi) {
    if (!prolaziPretragu(red, upit)) continue;
    const etapa = resolveMainLeg(red, danas) ?? etapaPolaska(red);
    const s = stavka(red, etapa);
    if (!prolaziDestinacije(s, dozvoljene)) continue;
    stavke.push(s);
  }

  return sortirajStavke(stavke, opcije.sort);
}

/**
 * The one entry point the list screen calls. Picks the mode from the filter
 * state so no component has to reimplement the choice.
 */
export function prikaziListu(
  redovi: readonly RezervacijaRed[],
  stanje: StanjeListe,
): { rezim: RezimPrikaza; stavke: StavkaListe[] } {
  const rezim = rezimPrikaza(stanje);
  const opcije: OpcijeListe = {
    danas: stanje.danas,
    destinacije: stanje.destinacije,
    pretraga: stanje.pretraga,
    sort: stanje.sort,
    katalog: stanje.katalog,
  };

  if (rezim === "dan" && stanje.opseg) {
    return { rezim, stavke: danView(redovi, { ...opcije, opseg: stanje.opseg }) };
  }
  if (rezim === "pretraga") {
    return { rezim, stavke: pretragaView(redovi, opcije) };
  }
  return { rezim: "raspored", stavke: rasporedView(redovi, opcije) };
}

export type GrupaDana = { datum: Datum; stavke: StavkaListe[] };

/**
 * Cards grouped under date headings (SPEC §6). Preserves the order it is
 * given, so it must be fed an already-sorted list.
 */
export function grupisiPoDanu(stavke: readonly StavkaListe[]): GrupaDana[] {
  const grupe: GrupaDana[] = [];
  for (const s of stavke) {
    const poslednja = grupe[grupe.length - 1];
    if (poslednja && poslednja.datum === s.datum) poslednja.stavke.push(s);
    else grupe.push({ datum: s.datum, stavke: [s] });
  }
  return grupe;
}

/**
 * Split into the *Polasci* / *Povratci* headings the Dan view shows. Order
 * within each group is preserved.
 */
export function grupisiPoSmeru(stavke: readonly StavkaListe[]): {
  polasci: StavkaListe[];
  povratci: StavkaListe[];
} {
  return {
    polasci: stavke.filter((s) => s.smer === "odlazak"),
    povratci: stavke.filter((s) => s.smer === "povratak"),
  };
}
