/**
 * Date ranges and filter composition — SPEC §3.
 *
 * Date and destination **AND** together; several destinations **OR** together;
 * both can be active at once.
 *
 * All calendar arithmetic goes through `src/lib/datum.ts`. Nothing here builds
 * a JS `Date` from a date string — `new Date("2026-01-01")` is midnight UTC
 * and is the previous day in half the world.
 */
import {
  jeDatum,
  krajMeseca,
  krajNedelje,
  pocetakMeseca,
  pocetakNedelje,
} from "@/lib/datum";
import { proveriDanas } from "./glavna-etapa";
import type { Datum, OpsegDatuma, StanjeListe, StavkaListe } from "./tipovi";

/** The quick chips: *danas · ova nedelja · ovaj mesec*. */
export type CipDatuma = "danas" | "ovaNedelja" | "ovajMesec";

/** A single day as a range, so one code path handles day and range alike. */
export function opsegZaDan(datum: Datum): OpsegDatuma {
  proveriDanas(datum);
  return { od: datum, do: datum };
}

export function opsegZaCip(cip: CipDatuma, danas: Datum): OpsegDatuma {
  proveriDanas(danas);
  switch (cip) {
    case "danas":
      return opsegZaDan(danas);
    case "ovaNedelja":
      // Monday–Sunday. `pocetakNedelje` is computed from the string in UTC.
      return { od: pocetakNedelje(danas), do: krajNedelje(danas) };
    case "ovajMesec":
      return { od: pocetakMeseca(danas), do: krajMeseca(danas) };
  }
}

/**
 * Validates a range and puts it the right way round.
 *
 * A custom picker can hand back `od` after `do` — accepted and swapped rather
 * than silently returning nothing, because an empty list looks like a bug.
 */
export function normalizujOpseg(opseg: OpsegDatuma): OpsegDatuma {
  if (!jeDatum(opseg.od) || !jeDatum(opseg.do)) {
    throw new Error(
      `Neispravan opseg datuma: ${String(opseg.od)} – ${String(opseg.do)}`,
    );
  }
  return opseg.od <= opseg.do
    ? { od: opseg.od, do: opseg.do }
    : { od: opseg.do, do: opseg.od };
}

/** Inclusive at both ends. ISO date strings compare correctly as strings. */
export function uOpsegu(datum: Datum, opseg: OpsegDatuma): boolean {
  return datum >= opseg.od && datum <= opseg.do;
}

/**
 * The destination half of the filter, applied to **the leg's own destination**
 * — not to the reservation as a whole.
 *
 * That is what makes `Grčka` with no date return only trips that have not
 * departed: once one departs, its main destination becomes Beograd and it
 * correctly leaves the filter.
 *
 * `null` means no destination filter is active, which passes everything.
 */
export function prolaziDestinacije(
  stavka: StavkaListe,
  dozvoljene: ReadonlySet<string> | null,
): boolean {
  return dozvoljene === null || dozvoljene.has(stavka.destinacija.id);
}

/**
 * How many filters the badge should show (SPEC §3).
 *
 * The date filter counts as one however wide the range is; each ticked
 * destination counts as one. Search is its own control and is not counted.
 */
export function brojAktivnihFiltera(stanje: {
  opseg?: OpsegDatuma | null;
  destinacije?: readonly string[];
}): number {
  return (stanje.opseg ? 1 : 0) + (stanje.destinacije?.length ?? 0);
}

/**
 * Which of the three list shapes a filter state asks for.
 *
 * A date filter is a question about a *day*, so it always wins: it turns the
 * list from "what is coming up" into "what happens on that date" (SPEC §2).
 * Search comes next because it is the only way to reach a booking with no main
 * date. Otherwise it is the default Raspored.
 */
export function rezimPrikaza(stanje: StanjeListe): "raspored" | "dan" | "pretraga" {
  if (stanje.opseg) return "dan";
  if (stanje.pretraga && stanje.pretraga.trim() !== "") return "pretraga";
  return "raspored";
}
