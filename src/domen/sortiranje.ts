/**
 * Sort order — SPEC §2 and §3.
 *
 * **There is one order and it is not a choice** (SPEC §3, amended 09.09.2026 at
 * the owner's request: the *Sortiranje* section of the filter sheet was
 * removed). The list runs by date, soonest first, in both tabs. Everything
 * after the date is there to make that order **total**, so the same rows land
 * in the same sequence on every render whatever order Postgres returned them
 * in:
 *
 *   1. Date ascending
 *   2. Departures before returns
 *   3. Destination A–Z
 *   4. Name A–Z
 *   5. Reservation id
 *
 * Key 2 does nothing inside a tab, where every row points the same way. It is
 * kept because the sort is defined over a list of legs and runs before
 * `grupisiPoSmeru` splits them, so it must not depend on who is looking.
 *
 * Both string comparisons go through `uporediTekst`, the one `sr-Latn`
 * collator. A bare `localeCompare()` depends on the machine's locale and a
 * byte sort puts Č, Ć, Š and Ž after Z, which is wrong for Serbian.
 */
import { uporediTekst } from "@/lib/tekst";
import { imeDestinacije } from "./destinacije";
import type { Datum, Smer, StavkaListe } from "./tipovi";

const REDOSLED_SMERA: Record<Smer, number> = { odlazak: 0, povratak: 1 };

/** ISO date strings compare correctly with `<`, so no `Date` is needed. */
export function uporediDatume(a: Datum, b: Datum): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Everything after the date — what makes the order total. */
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

export function uporediStavke(a: StavkaListe, b: StavkaListe): number {
  const datum = uporediDatume(a.datum, b.datum);
  return datum !== 0 ? datum : tiebreak(a, b);
}

/** Returns a new array; never sorts the caller's list in place. */
export function sortirajStavke(stavke: readonly StavkaListe[]): StavkaListe[] {
  return [...stavke].sort(uporediStavke);
}
