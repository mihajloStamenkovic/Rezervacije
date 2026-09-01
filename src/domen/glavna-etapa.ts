/**
 * The main leg rule — SPEC §1. The idea the whole app turns on.
 *
 * Every reservation has two legs but only ever one *main* date, and which leg
 * that is depends on today:
 *
 *   datum_polaska >= danas  → ↑ Odlazak, to the trip destination
 *   otherwise, if there is
 *   a datum_povratka        → ↓ Povratak, to the home destination
 *   otherwise               → no main leg at all
 *
 * The boundary is `>=`, not `>`: a booking departing *today* is still a
 * departure. It flips the day *after* it departs.
 *
 * `danas` is always injected — a `YYYY-MM-DD` string computed in
 * Europe/Belgrade by `danasBeograd()` at the entry point. Nothing in here
 * reads a clock, which is what keeps the two accounts seeing the same list
 * from two different countries (SPEC §7).
 */
import { jeDatum } from "@/lib/datum";
import type { Datum, Etapa, GlavnaEtapa, RezervacijaRed } from "./tipovi";

/**
 * Guards the one comparison the app hinges on. `"2026-1-5" >= "2026-01-15"` is
 * a perfectly quiet `true`, so a malformed date must fail loudly instead.
 */
export function proveriDanas(danas: Datum): Datum {
  if (!jeDatum(danas)) {
    throw new Error(
      `Neispravan datum: ${String(danas)}. ` +
        `Očekuje se YYYY-MM-DD iz danasBeograd().`,
    );
  }
  return danas;
}

/** The outbound leg. Every reservation has one — `datum_polaska` is required. */
export function etapaPolaska(red: RezervacijaRed): Etapa {
  return {
    smer: "odlazak",
    datum: red.rezervacija.datumPolaska,
    destinacija: red.destinacija,
  };
}

/** The return leg, or `null` when the return has not been agreed yet. */
export function etapaPovratka(red: RezervacijaRed): Etapa | null {
  const datum = red.rezervacija.datumPovratka;
  if (!datum) return null;
  return { smer: "povratak", datum, destinacija: red.destinacijaPovratka };
}

/** Both legs of a booking, outbound first. One or two entries. */
export function sveEtape(red: RezervacijaRed): Etapa[] {
  const povratak = etapaPovratka(red);
  return povratak ? [etapaPolaska(red), povratak] : [etapaPolaska(red)];
}

/**
 * SPEC §1, exactly.
 *
 * Returns `null` when the departure has passed and no return date was ever
 * filled in — that booking has no main date and drops off the list entirely
 * (reachable by search, or by filtering its past departure date).
 *
 * Note what this deliberately does *not* do: it does not check that the main
 * date is still in the future. A booking that departed *and* returned last
 * month still resolves to its return leg, which is what the detail screen
 * wants. The "from today forward" horizon belongs to `rasporedView`, not to
 * the rule.
 */
export function resolveMainLeg(
  red: RezervacijaRed,
  danas: Datum,
): GlavnaEtapa | null {
  proveriDanas(danas);
  const { datumPolaska, datumPovratka } = red.rezervacija;

  if (datumPolaska >= danas) {
    return {
      smer: "odlazak",
      datum: datumPolaska,
      destinacija: red.destinacija,
    };
  }

  if (datumPovratka) {
    return {
      smer: "povratak",
      datum: datumPovratka,
      destinacija: red.destinacijaPovratka,
    };
  }

  return null;
}

/** `true` when the booking is on no list at all — SPEC §1, edge case one. */
export function bezGlavneEtape(red: RezervacijaRed, danas: Datum): boolean {
  return resolveMainLeg(red, danas) === null;
}
