/**
 * The list modes — SPEC §2.
 *
 * Two things decide what a row is: whether a date filter is on, and which
 * **tab** is on screen.
 *
 * **The tabs are the leg direction** (SPEC §2, amended 09.09.2026 at the
 * owner's request). *Odlasci* holds every departure leg, *Povratak* every
 * return leg, so a round trip is on both — under its departure date in one and
 * its return date in the other. That is why every view below emits **legs**
 * and `prikaziListu` splits them at the end: the main leg rule no longer picks
 * one leg per booking for the list. It still governs the detail screen, where
 * one booking has to resolve to one date.
 *
 *   **Raspored** (no date filter) — every leg from today forward. Answers
 *   "what is coming up".
 *
 *   **Dan** (date filter active) — every leg falling inside the range, past
 *   days included. Answers "what happens on 01.01.2026".
 *
 *   **Pretraga** (search, no date filter) — every leg of every match, with no
 *   horizon at all, because search is the only way to reach a booking that
 *   departed with no return date.
 *
 * Three separate functions on purpose. They differ only in which dates they
 * admit, but that is exactly the thing that is easy to get subtly wrong, and a
 * single function with a mode flag would hide it behind a branch.
 */
import { destinacijeIzRedova, razresiDestinacije } from "./destinacije";
import {
  normalizujOpseg,
  prolaziDestinacije,
  rezimPrikaza,
  uOpsegu,
} from "./filteri";
import { proveriDanas, sveEtape } from "./glavna-etapa";
import { pripremiUpit, prolaziPretragu } from "./pretraga";
import { sortirajStavke } from "./sortiranje";
import type {
  Datum,
  Destinacija,
  Etapa,
  OpsegDatuma,
  RezervacijaRed,
  RezimPrikaza,
  StanjeListe,
  StavkaListe,
} from "./tipovi";

/** Options shared by every mode. */
export type OpcijeListe = {
  danas: Datum;
  destinacije?: readonly string[];
  pretraga?: string | null;
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
 * **Raspored** — the default list. Every leg from today forward, sorted by
 * date ascending.
 *
 * The two exclusions SPEC §1 describes fall out of the shape rather than being
 * written down: a leg that has already happened is not "what is coming up",
 * and a booking that departed with no return date has no leg left that passes
 * — its departure is behind us and it never had a return. That booking is
 * still reachable only by search or by filtering its past departure date,
 * which is the trade SPEC §8 records and the owner reaffirmed on 09.09.2026.
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
    if (!prolaziPretragu(red, upit)) continue;
    for (const etapa of sveEtape(red)) {
      if (etapa.datum < danas) continue;
      const s = stavka(red, etapa);
      if (!prolaziDestinacije(s, dozvoljene)) continue;
      stavke.push(s);
    }
  }

  return sortirajStavke(stavke);
}

/**
 * **Dan** — every leg falling inside the chosen date or range.
 *
 * The "from today forward" horizon does not apply here: the question is about
 * a day, and that day may be in the past. This is the second half of the
 * SPEC §1 edge case — a booking that departed with no return date is reachable
 * "by search on the name, **or by filtering its past departure date**".
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

  return sortirajStavke(stavke);
}

/**
 * **Pretraga** — every leg of every match, with no date horizon.
 *
 * A booking that departed with no return date has exactly one leg, its
 * departure, and that leg is in the past — so this is the only view that shows
 * it, and it shows it under *Odlasci*. That is what makes search the rescue
 * route SPEC §2 says it is.
 */
export function pretragaView(
  redovi: readonly RezervacijaRed[],
  opcije: OpcijeListe,
): StavkaListe[] {
  proveriDanas(opcije.danas);
  const dozvoljene = dozvoljeneDestinacije(opcije, redovi);
  const upit = pripremiUpit(opcije.pretraga);

  const stavke: StavkaListe[] = [];
  for (const red of redovi) {
    if (!prolaziPretragu(red, upit)) continue;
    for (const etapa of sveEtape(red)) {
      const s = stavka(red, etapa);
      if (!prolaziDestinacije(s, dozvoljene)) continue;
      stavke.push(s);
    }
  }

  return sortirajStavke(stavke);
}

/** What the screen renders: the mode it is in, and one list per tab. */
export type PrikazListe = {
  rezim: RezimPrikaza;
  odlasci: StavkaListe[];
  povratci: StavkaListe[];
};

/**
 * The one entry point the list screen calls. Picks the mode from the filter
 * state and hands back **both** tabs, because both are rendered at once — the
 * swipe between them is a client-side move and must not wait on a second
 * server render.
 */
export function prikaziListu(
  redovi: readonly RezervacijaRed[],
  stanje: StanjeListe,
): PrikazListe {
  const rezim = rezimPrikaza(stanje);
  const opcije: OpcijeListe = {
    danas: stanje.danas,
    destinacije: stanje.destinacije,
    pretraga: stanje.pretraga,
    katalog: stanje.katalog,
  };

  let stavke: StavkaListe[];
  if (rezim === "dan" && stanje.opseg) {
    stavke = danView(redovi, { ...opcije, opseg: stanje.opseg });
  } else if (rezim === "pretraga") {
    stavke = pretragaView(redovi, opcije);
  } else {
    stavke = rasporedView(redovi, opcije);
  }

  const { polasci, povratci } = grupisiPoSmeru(stavke);
  return { rezim, odlasci: polasci, povratci };
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
 * Split a resolved list into the two tabs — *Odlasci* and *Povratak*.
 *
 * Order within each is preserved, so a sorted list in gives two sorted lists
 * out. This is the last step of `prikaziListu` and the whole of what a tab is.
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
