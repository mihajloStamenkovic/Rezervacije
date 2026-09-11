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
 *
 * **Amended 11.09.2026, at the owner's request.** A one-way booking whose
 * outbound column is already a Serbian destination and whose other column is
 * not — Odakle: Grčka, Kuda: Beograd, no `datum_povratka` — is a passenger
 * coming home, not one leaving, however the columns happen to be laid out.
 * `jeJednosmernaKuci` below carves that case out of the `↑ Odlazak` branch
 * everywhere `smer` is read from a leg: the list tabs, the same-day sort
 * tie-break, and the Detalji chip all follow.
 */
import { jeDatum } from "@/lib/datum";
import type { Datum, Etapa, GlavnaEtapa, RezervacijaRed, Ruta, Smer } from "./tipovi";

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

/**
 * Serbia — the home country, compared by the stable code rather than the
 * display name, the same way `src/db/seed.ts` and the destination cascade
 * already do.
 */
const DRZAVA_SIFRA_SRBIJA = "srbija";

function jeUSrbiji(destinacija: RezervacijaRed["destinacija"]): boolean {
  return destinacija.drzavaSifra === DRZAVA_SIFRA_SRBIJA;
}

/**
 * A one-way ride *home from abroad* — SPEC §5's Odakle/Kuda reading of a
 * `Jednosmerna vožnja`, where Kuda already holds a Serbian destination and
 * Odakle does not. This is what makes the booking a homecoming rather than a
 * departure, whichever column the data happens to sit in.
 *
 * The `!jeUSrbiji(destinacijaPovratka)` half matters: without it, an ordinary
 * one-way drop-off at **Kopaonik** with no return date yet — a real booking,
 * since Kopaonik is itself Serbian — would flip too, because its Odakle
 * column defaults to Beograd and both columns would read as home. Requiring
 * the *other* end to be abroad is what limits this to genuine cross-border
 * homecomings.
 */
export function jeJednosmernaKuci(red: RezervacijaRed): boolean {
  return (
    jeJednosmerna(red) &&
    jeUSrbiji(red.destinacija) &&
    !jeUSrbiji(red.destinacijaPovratka)
  );
}

/** The outbound leg. Every reservation has one — `datum_polaska` is required. */
export function etapaPolaska(red: RezervacijaRed): Etapa {
  return {
    // A ride home from abroad reads as `povratak` here even though it is
    // structurally the outbound column — see `jeJednosmernaKuci`. `rutaEtape`
    // must not be handed this value for that reason; see `strukturniSmer`.
    smer: jeJednosmernaKuci(red) ? "povratak" : "odlazak",
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
      // Same carve-out as `etapaPolaska` — see `jeJednosmernaKuci`.
      smer: jeJednosmernaKuci(red) ? "povratak" : "odlazak",
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

/**
 * Where a leg starts and where it ends — SPEC §4, read against the grain.
 *
 * A card showing only `↓ Povratak · Beograd` says they are arriving but not
 * where from, which is half the dispatch question. The other half is
 * recoverable, because a booking's two destination columns are the two ends of
 * the same journey and the direction says which is which:
 *
 *   odlazak   home → trip destination     (destinacijaPovratka → destinacija)
 *   povratak  trip destination → home     (destinacija → destinacijaPovratka)
 *
 * **This is inference, not stored data.** There is no origin column: SPEC §4
 * has `destinacija_id` and `destinacija_povratka_id` and nothing else, and the
 * nine columns are fixed. Treating "where they come back to" as "where they
 * set out from" is exact for a round trip, and exact for the one-way ride home
 * the owner also books, because there the outbound column already holds home.
 *
 * It degenerates only when both columns are the same place — a booking that
 * departs Beograd and returns to Beograd — where both ends are honestly the
 * same and the caller can collapse the pair rather than draw an arrow from a
 * town to itself.
 *
 * **The `smer` here picks a formula, not a business direction.** For a ride
 * home from abroad, `etapaPolaska` reports `smer: "povratak"` (see
 * `jeJednosmernaKuci`) even though `destinacija` is still the outbound
 * column — feeding that reported `smer` in here would draw the arrow
 * backwards. Callers reading a leg's own `smer` off an `Etapa`/`StavkaListe`
 * must go through `strukturniSmer` instead of using it directly.
 */
export function rutaEtape(red: RezervacijaRed, smer: Smer): Ruta {
  return smer === "odlazak"
    ? { od: red.destinacijaPovratka, do: red.destinacija }
    : { od: red.destinacija, do: red.destinacijaPovratka };
}

/**
 * Which formula `rutaEtape` needs for a given leg — structural, and never
 * overridden the way `Etapa.smer` can be for a ride home from abroad.
 *
 * A leg's `destinacija` is `red.destinacija` when it came from `etapaPolaska`
 * and `red.destinacijaPovratka` when it came from `etapaPovratka`; comparing
 * ids recovers that regardless of what `smer` was relabelled to. In the
 * degenerate case where both columns are the same place, either branch
 * yields the same already-collapsed route, so which one this picks does not
 * matter.
 */
export function strukturniSmer(red: RezervacijaRed, etapa: Etapa): Smer {
  return etapa.destinacija.id === red.destinacija.id ? "odlazak" : "povratak";
}

/** `true` when both ends are the same place, so one name says everything. */
export function jeIstaTacka(ruta: Ruta): boolean {
  return ruta.od.id === ruta.do.id;
}

/**
 * A one-way booking: out, and not scheduled back.
 *
 * There is no `jednosmerno` column and there is not going to be one — the nine
 * columns are fixed (standing rule 2). A missing `datum_povratka` *is* the
 * one-way flag, which is the same absence SPEC §8 already relies on for
 * "return leg optional".
 *
 * The cost of storing it as an absence rather than a flag is that the data
 * cannot distinguish "this trip is one-way" from "the return is not confirmed
 * yet". Nothing in the app behaves differently between those two, so nothing
 * is lost today; it is worth knowing before anyone tries to report on it.
 *
 * On a one-way, `destinacijaPovratka` is read as *where they set out from*
 * rather than where they come back to. For a round trip those are the same
 * place — home — so this is a reading of the column, not a change to it, and
 * it is the same reading `rutaEtape` already applies to the outbound leg.
 */
export function jeJednosmerna(red: RezervacijaRed): boolean {
  return red.rezervacija.datumPovratka === null;
}
