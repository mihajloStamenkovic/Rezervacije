/**
 * The shapes the domain core speaks in.
 *
 * Nothing in `src/domen/` imports a database handle. The input is a plain
 * joined row and the output is a plain array — that is what makes every rule
 * in here testable at a fixed `danas` with no env vars and no connection.
 *
 * `RezervacijaRed` is declared structurally from the Drizzle *schema* types
 * rather than imported from `src/db/queries.ts`, because that file starts with
 * `import "server-only"` and pulling it in — even by accident, through a
 * non-elided type import — would break a plain vitest run. Both declarations
 * are built from the same `$inferSelect` types, so they cannot drift in shape
 * without a type error appearing where the query layer feeds the views.
 */
import type { Destinacija, Profile, Reservation } from "@/db/schema";
import type { Datum } from "@/lib/datum";

export type { Datum, Destinacija, Profile, Reservation };

/** A reservation with both destination rows and its author already resolved. */
export type RezervacijaRed = {
  rezervacija: Reservation;
  destinacija: Destinacija;
  destinacijaPovratka: Destinacija;
  autor: Profile;
};

/** Which of the two legs a row is about. */
export type Smer = "odlazak" | "povratak";

/**
 * One leg of a booking: a direction, the date it happens on, and where it goes.
 *
 * For `odlazak` that is `datum_polaska` → `destinacija`; for `povratak` it is
 * `datum_povratka` → `destinacija_povratka`.
 */
export type Etapa = {
  smer: Smer;
  datum: Datum;
  destinacija: Destinacija;
};

/** What `resolveMainLeg` returns. `null` when the booking has no main date. */
export type GlavnaEtapa = Etapa;

/**
 * One rendered row. Raspored emits one per reservation; Dan emits one per
 * matching leg, so the same reservation can appear twice — which is why
 * `kljuc` exists and the reservation id alone is not enough.
 */
export type StavkaListe = Etapa & {
  red: RezervacijaRed;
  /** Stable identity of this row: `<id>#<smer>`. Safe as a React key. */
  kljuc: string;
};

/**
 * Both ends of one leg — where it starts and where it finishes.
 *
 * Inferred, not stored: the schema has two destination columns and no origin
 * column, so the far end of a leg is the *other* column. See `rutaEtape`.
 */
export type Ruta = { od: Destinacija; do: Destinacija };

/** An inclusive calendar range. A single day is `od === do`. */
export type OpsegDatuma = { od: Datum; do: Datum };

export type PoljeSortiranja = "datum" | "destinacija";
export type SmerSortiranja = "rastuce" | "opadajuce";
export type Sortiranje = { polje: PoljeSortiranja; smer: SmerSortiranja };

/**
 * Everything the list screen can have switched on at once.
 *
 * Date and destination AND together; several destinations OR together
 * (SPEC §3). `destinacije` holds *filter keys* — a country, a region or a
 * city — resolved through the reference table by `razresiDestinacije`.
 */
export type StanjeListe = {
  danas: Datum;
  opseg?: OpsegDatuma | null;
  destinacije?: readonly string[];
  pretraga?: string | null;
  sort?: Sortiranje;
  /**
   * The destination reference table. Optional: when absent the rollup is
   * resolved against the destinations carried by the rows themselves, which
   * yields the same matches because a leg can only point at a row that is
   * already there.
   */
  katalog?: readonly Destinacija[];
};

/** Which of the three list shapes a given filter state asks for. */
export type RezimPrikaza = "raspored" | "dan" | "pretraga";
