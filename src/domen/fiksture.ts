/**
 * Test fixtures — a paper copy of `src/db/seed.ts`.
 *
 * The eight seed reservations were built to be awkward rather than
 * representative, and each one is annotated in `seed.ts` with the rule it
 * targets. They are reproduced here row for row, with the same relative day
 * offsets, so a domain test and a look at the real database are asking the
 * same question. `DANAS` is a fixed string — the whole point of injecting
 * "today" is that these fixtures never mean something different tomorrow.
 *
 * Not a `.test.ts` file, so vitest treats it as a module, not a suite. It is
 * imported only by tests; nothing in the app depends on it.
 */
import { pomeriDane } from "@/lib/datum";
import type { Datum, Destinacija, Profile, RezervacijaRed } from "./tipovi";

/** A Thursday in January, chosen so week and month boundaries are non-trivial. */
export const DANAS: Datum = "2026-01-15";

export const dan = (pomak: number): Datum => pomeriDane(DANAS, pomak);

function destinacija(
  n: number,
  drzava: string,
  drzavaSifra: string,
  regija: string,
  grad: string,
  redosled: number,
  aktivna = true,
): Destinacija {
  return {
    id: `00000000-0000-4000-8000-2000000000${String(n).padStart(2, "0")}`,
    drzava,
    drzavaSifra,
    regija,
    grad,
    aktivna,
    redosled,
  };
}

// A faithful slice of `data/destinacije.json`, including `redosled` restarting
// within each country, and Slovenija inactive as the client's site has it.
export const BEOGRAD = destinacija(1, "Srbija", "srbija", "Beograd", "Beograd", 0);
export const KOPAONIK = destinacija(2, "Srbija", "srbija", "Kopaonik", "Kopaonik", 1);
export const SOLUN = destinacija(3, "Grčka", "grcka", "Solun i okolina", "Solun", 0);
export const SARTI = destinacija(4, "Grčka", "grcka", "Sitonija", "Sarti", 4);
export const HANIOTI = destinacija(5, "Grčka", "grcka", "Kasandra", "Hanioti", 10);
export const SIVIRI = destinacija(6, "Grčka", "grcka", "Kasandra", "Siviri", 15);
export const ZAGREB = destinacija(7, "Hrvatska", "hrvatska", "Zagreb", "Zagreb", 0);
export const LJUBLJANA = destinacija(
  8,
  "Slovenija",
  "slovenija",
  "Slovenija",
  "Ljubljana",
  0,
  false,
);

export const KATALOG: Destinacija[] = [
  BEOGRAD,
  KOPAONIK,
  SOLUN,
  SARTI,
  HANIOTI,
  SIVIRI,
  ZAGREB,
  LJUBLJANA,
];

export const NIKOLA: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  ime: "Nikola",
  email: "nikola@example.test",
  boja: "#2563eb",
};

export const MARIJA: Profile = {
  id: "00000000-0000-4000-8000-000000000002",
  ime: "Marija",
  email: "marija@example.test",
  boja: "#d97706",
};

type Ulaz = {
  n: number;
  ime: string;
  telefon: string;
  destinacija: Destinacija;
  datumPolaska: Datum;
  destinacijaPovratka?: Destinacija;
  datumPovratka?: Datum | null;
  brojPutnika: number;
  autor?: Profile;
};

export function red(u: Ulaz): RezervacijaRed {
  const destinacijaPovratka = u.destinacijaPovratka ?? BEOGRAD;
  const autor = u.autor ?? NIKOLA;
  return {
    rezervacija: {
      id: `00000000-0000-4000-8000-1000000000${String(u.n).padStart(2, "0")}`,
      ime: u.ime,
      telefon: u.telefon,
      destinacijaId: u.destinacija.id,
      datumPolaska: u.datumPolaska,
      destinacijaPovratkaId: destinacijaPovratka.id,
      datumPovratka: u.datumPovratka ?? null,
      brojPutnika: u.brojPutnika,
      kreirao: autor.id,
    },
    destinacija: u.destinacija,
    destinacijaPovratka,
    autor,
  };
}

/** #1 — the SPEC §1 worked example: departs in two weeks, returns in four. */
export const R1 = red({
  n: 1,
  ime: "Marko Petrović",
  telefon: "+381641234567",
  destinacija: HANIOTI,
  datumPolaska: dan(14),
  datumPovratka: dan(28),
  brojPutnika: 4,
});

/** #2 — departing TODAY. The `>=` boundary: still ↑ Odlazak. */
export const R2 = red({
  n: 2,
  ime: "Jelena Ilić",
  telefon: "+381631112233",
  destinacija: SOLUN,
  datumPolaska: dan(0),
  datumPovratka: dan(7),
  brojPutnika: 2,
  autor: MARIJA,
});

/** #3 — departed, return still ahead. Flips to ↓ Povratak, leaves the Grčka filter. */
export const R3 = red({
  n: 3,
  ime: "Porodica Jovanović",
  telefon: "+381652223344",
  destinacija: SIVIRI,
  datumPolaska: dan(-5),
  datumPovratka: dan(9),
  brojPutnika: 5,
});

/** #4 — departed, NO return date. No main leg; drops off every list. */
export const R4 = red({
  n: 4,
  ime: "Stefan Nikolić",
  telefon: "+381603334455",
  destinacija: ZAGREB,
  datumPolaska: dan(-3),
  datumPovratka: null,
  brojPutnika: 1,
  autor: MARIJA,
});

/** #5 — one-way ride HOME: Beograd sits in the *outbound* column. */
export const R5 = red({
  n: 5,
  ime: "Ana Marković",
  telefon: "+381644445566",
  destinacija: BEOGRAD,
  datumPolaska: dan(3),
  datumPovratka: null,
  brojPutnika: 3,
});

/** #6 — same-day round trip. Two rows in that day's view; 21 putnik. */
export const R6 = red({
  n: 6,
  ime: "Dragan Đorđević",
  telefon: "+381665556677",
  destinacija: KOPAONIK,
  datumPolaska: dan(2),
  datumPovratka: dan(2),
  brojPutnika: 21,
  autor: MARIJA,
});

/** #7 — points at an INACTIVE destination (Ljubljana). Must still resolve. */
export const R7 = red({
  n: 7,
  ime: "Šaban Šaulić",
  telefon: "+381667778899",
  destinacija: LJUBLJANA,
  datumPolaska: dan(10),
  datumPovratka: dan(12),
  brojPutnika: 2,
});

/** #8 — same main date as #6, different destination. The A–Z tiebreak. */
export const R8 = red({
  n: 8,
  ime: "Aleksandar Cvetković",
  telefon: "+381628889900",
  destinacija: HANIOTI,
  datumPolaska: dan(2),
  datumPovratka: dan(16),
  brojPutnika: 6,
  autor: MARIJA,
});

/**
 * All eight, deliberately **not** in any meaningful order — `sveRezervacije()`
 * promises none, so a test that only passes on sorted input is testing the
 * fixture rather than the sort.
 */
export const SVI: RezervacijaRed[] = [R6, R2, R8, R4, R1, R7, R3, R5];

/** Look a row's items up by reservation name, for readable assertions. */
export const imena = (stavke: readonly { red: RezervacijaRed }[]): string[] =>
  stavke.map((s) => s.red.rezervacija.ime);
