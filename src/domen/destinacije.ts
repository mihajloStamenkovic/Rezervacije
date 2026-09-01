/**
 * The destination filter — SPEC §5.
 *
 * Two rules govern it and both matter.
 *
 * **1. Selecting a level matches everything under it.** The reference data is
 * three levels (država → regija → grad) and a checkbox can sit on any of them.
 * Ticking `Grčka` must match a booking whose leg is Hanioti; ticking
 * `Kasandra` must match Hanioti but not Sarti. That is done here as a rollup
 * *over the reference table*: a selection is expanded into the concrete set of
 * destination ids it covers, and matching is then an id lookup. Never a string
 * comparison against a reservation's denormalised country name.
 *
 * **2. One canonical list.** A place appears once and matches from *either*
 * `destinacija_id` or `destinacija_povratka_id`. The owner books one-way rides
 * home — Greece → Belgrade — with Beograd in the *outbound* column, so a list
 * split into "trip destinations" and "home towns" would show Beograd twice and
 * each checkbox would silently miss half the bookings.
 *
 * Grouping the UI by country is a real hierarchy and is encouraged.
 * Grouping by trip-versus-home is wrong.
 */
import { uporediTekst } from "@/lib/tekst";
import type { Destinacija, RezervacijaRed } from "./tipovi";

/** What a filter checkbox sits on. */
export type NivoDestinacije = "drzava" | "regija" | "grad";

const RAZDVOJNIK = "|";

/** `drzava:grcka` — matches every city in Grčka. */
export function kljucDrzave(d: Destinacija): string {
  return `drzava:${d.drzavaSifra}`;
}

/**
 * `regija:grcka|Kasandra` — matches every city in that region.
 *
 * The country code is part of the key because region names are only unique
 * within a country.
 */
export function kljucRegije(d: Destinacija): string {
  return `regija:${d.drzavaSifra}${RAZDVOJNIK}${d.regija}`;
}

/** `grad:<uuid>` — matches exactly one destination row. */
export function kljucGrada(d: Destinacija): string {
  return `grad:${d.id}`;
}

export function nivoKljuca(kljuc: string): NivoDestinacije | null {
  if (kljuc.startsWith("drzava:")) return "drzava";
  if (kljuc.startsWith("regija:")) return "regija";
  if (kljuc.startsWith("grad:")) return "grad";
  return null;
}

/**
 * The rollup. Expands a selection of checkbox keys into the set of destination
 * ids they cover, against the reference table.
 *
 * Several selections **OR** together (SPEC §3), which is exactly a set union.
 * Keys with an unrecognised prefix are ignored rather than thrown on — filter
 * state travels through the URL and a stale key must not crash the list.
 */
export function razresiDestinacije(
  kljucevi: readonly string[],
  katalog: readonly Destinacija[],
): Set<string> {
  const drzave = new Set<string>();
  const regije = new Set<string>();
  const gradovi = new Set<string>();

  for (const kljuc of kljucevi) {
    const nivo = nivoKljuca(kljuc);
    if (nivo === "drzava") drzave.add(kljuc.slice("drzava:".length));
    else if (nivo === "regija") regije.add(kljuc.slice("regija:".length));
    else if (nivo === "grad") gradovi.add(kljuc.slice("grad:".length));
  }

  const ids = new Set<string>();
  for (const d of katalog) {
    if (
      drzave.has(d.drzavaSifra) ||
      regije.has(`${d.drzavaSifra}${RAZDVOJNIK}${d.regija}`) ||
      gradovi.has(d.id)
    ) {
      ids.add(d.id);
    }
  }
  return ids;
}

/**
 * Every distinct destination the given reservations actually reference, from
 * **either** column. Deduplicated by id, so Beograd appears once whether it
 * arrived as a trip destination or as a homecoming.
 */
export function destinacijeIzRedova(
  redovi: readonly RezervacijaRed[],
): Destinacija[] {
  const poId = new Map<string, Destinacija>();
  for (const red of redovi) {
    poId.set(red.destinacija.id, red.destinacija);
    poId.set(red.destinacijaPovratka.id, red.destinacijaPovratka);
  }
  return sortirajDestinacije([...poId.values()]);
}

/**
 * The one canonical list that feeds the filter checkboxes.
 *
 * Everything offerable today, **plus** anything an existing booking points at.
 * The second half is not optional: SPEC §5 says an inactive destination is
 * hidden from the new-reservation dropdowns but is "still present in the
 * filter if a booking references it" — the Ljubljana booking has to stay
 * findable after Slovenija was marked unavailable.
 */
export function destinacijeZaFilter(
  katalog: readonly Destinacija[],
  redovi: readonly RezervacijaRed[] = [],
): Destinacija[] {
  const poId = new Map<string, Destinacija>();
  for (const d of katalog) {
    if (d.aktivna) poId.set(d.id, d);
  }
  for (const d of destinacijeIzRedova(redovi)) poId.set(d.id, d);
  return sortirajDestinacije([...poId.values()]);
}

/** Country, then region, then city — all through the one `sr-Latn` collator. */
export function sortirajDestinacije(list: Destinacija[]): Destinacija[] {
  return [...list].sort(
    (a, b) =>
      uporediTekst(a.drzava, b.drzava) ||
      uporediTekst(a.regija, b.regija) ||
      uporediTekst(a.grad, b.grad),
  );
}

/** What a card and the sort comparator call a destination. */
export function imeDestinacije(d: Destinacija): string {
  return d.grad;
}

/** `Grčka › Kasandra › Hanioti` — for the detail screen. */
export function punoImeDestinacije(d: Destinacija): string {
  return `${d.drzava} › ${d.regija} › ${d.grad}`;
}

export type CvorGrada = {
  kljuc: string;
  id: string;
  naziv: string;
  aktivna: boolean;
};

export type CvorRegije = {
  kljuc: string;
  naziv: string;
  gradovi: CvorGrada[];
};

export type CvorDrzave = {
  kljuc: string;
  sifra: string;
  naziv: string;
  regije: CvorRegije[];
};

/**
 * The checkbox tree, grouped by country (SPEC §6, screen 2).
 *
 * Alphabetical at every level via `uporediTekst`, not by `redosled`: the
 * `redosled` column is the client's display order for the booking dropdowns,
 * while a filter list of forty-odd entries is scanned by eye and wants A–Z.
 */
export function stabloDestinacija(
  list: readonly Destinacija[],
): CvorDrzave[] {
  const drzave = new Map<string, CvorDrzave>();
  const regije = new Map<string, CvorRegije>();

  for (const d of sortirajDestinacije([...list])) {
    let drzava = drzave.get(d.drzavaSifra);
    if (!drzava) {
      drzava = {
        kljuc: kljucDrzave(d),
        sifra: d.drzavaSifra,
        naziv: d.drzava,
        regije: [],
      };
      drzave.set(d.drzavaSifra, drzava);
    }

    const kljucR = kljucRegije(d);
    let regija = regije.get(kljucR);
    if (!regija) {
      regija = { kljuc: kljucR, naziv: d.regija, gradovi: [] };
      regije.set(kljucR, regija);
      drzava.regije.push(regija);
    }

    regija.gradovi.push({
      kljuc: kljucGrada(d),
      id: d.id,
      naziv: d.grad,
      aktivna: d.aktivna,
    });
  }

  return [...drzave.values()].sort((a, b) => uporediTekst(a.naziv, b.naziv));
}
