/**
 * Sort order — SPEC §2 and §3.
 *
 * No times are stored, so same-day order needs an explicit rule or rows
 * shuffle between renders. Inside a day:
 *
 *   1. Departures before returns
 *   2. Destination A–Z
 *   3. Name A–Z
 *
 * Both string comparisons go through `uporediTekst`, the one `sr-Latn`
 * collator. A bare `localeCompare()` depends on the machine's locale and a
 * byte sort puts Č, Ć, Š and Ž after Z, which is wrong for Serbian.
 *
 * The order is a **total** one: reservation id is the final tiebreak, so two
 * bookings with the same date, direction, destination and name still land in
 * the same order on every render, whatever order the database returned them
 * in. Nothing here is random and nothing depends on input order.
 */
import { uporediTekst } from "@/lib/tekst";
import { imeDestinacije } from "./destinacije";
import type { Datum, Smer, Sortiranje, StavkaListe } from "./tipovi";

export const PODRAZUMEVANO_SORTIRANJE: Sortiranje = {
  polje: "datum",
  smer: "rastuce",
};

const REDOSLED_SMERA: Record<Smer, number> = { odlazak: 0, povratak: 1 };

/** ISO date strings compare correctly with `<`, so no `Date` is needed. */
export function uporediDatume(a: Datum, b: Datum): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The same-day rule, applied after whichever primary key is in play.
 *
 * It always runs ascending, even when the list is sorted descending: reversing
 * the day order is a user choice about days, not a reason to start showing
 * returns before departures within one of them.
 */
function tiebreak(a: StavkaListe, b: StavkaListe): number {
  const smer = REDOSLED_SMERA[a.smer] - REDOSLED_SMERA[b.smer];
  if (smer !== 0) return smer;

  const dest = uporediTekst(
    imeDestinacije(a.destinacija),
    imeDestinacije(b.destinacija),
  );
  if (dest !== 0) return dest;

  const ime = uporediTekst(a.red.rezervacija.ime, b.red.rezervacija.ime);
  if (ime !== 0) return ime;

  // Last resort, so the order never depends on the row order out of Postgres.
  const idA = a.red.rezervacija.id;
  const idB = b.red.rezervacija.id;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

export function uporediStavke(
  a: StavkaListe,
  b: StavkaListe,
  sort: Sortiranje = PODRAZUMEVANO_SORTIRANJE,
): number {
  const znak = sort.smer === "opadajuce" ? -1 : 1;

  if (sort.polje === "destinacija") {
    const dest = uporediTekst(
      imeDestinacije(a.destinacija),
      imeDestinacije(b.destinacija),
    );
    if (dest !== 0) return znak * dest;
    // Within one destination, chronological is the only useful order.
    const datum = uporediDatume(a.datum, b.datum);
    if (datum !== 0) return datum;
  } else {
    const datum = uporediDatume(a.datum, b.datum);
    if (datum !== 0) return znak * datum;
  }

  return tiebreak(a, b);
}

/** Returns a new array; never sorts the caller's list in place. */
export function sortirajStavke(
  stavke: readonly StavkaListe[],
  sort: Sortiranje = PODRAZUMEVANO_SORTIRANJE,
): StavkaListe[] {
  return [...stavke].sort((a, b) => uporediStavke(a, b, sort));
}
