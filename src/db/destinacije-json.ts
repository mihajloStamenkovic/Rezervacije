/**
 * Reads and flattens `data/destinacije.json` — the reference data captured
 * from eurotravel.rs (SPEC §5).
 *
 * The file is three levels (država → regija → grad); the table is one row per
 * city with country and region denormalised onto it. This module owns that
 * flattening so the seed and its tests agree on what the file means.
 *
 * Prices in the JSON are deliberately ignored: v1 does not show them and the
 * capture note says they are unverified.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DestinacijaSeed = {
  drzava: string;
  drzavaSifra: string;
  regija: string;
  grad: string;
  aktivna: boolean;
  redosled: number;
};

type RawRegija = {
  naziv: string;
  gradovi: string[];
  izvor?: string;
  napomena?: string;
};

type RawDrzava = {
  sifra: string;
  naziv: string;
  aktivna: boolean;
  napomena?: string;
  regije: RawRegija[];
};

type RawFile = {
  izvor: string;
  preuzeto: string;
  drzave: RawDrzava[];
};

export const DESTINACIJE_JSON_PATH = join(
  process.cwd(),
  "data",
  "destinacije.json",
);

export function ucitajDestinacije(
  path: string = DESTINACIJE_JSON_PATH,
): DestinacijaSeed[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawFile;
  const redovi: DestinacijaSeed[] = [];

  for (const drzava of raw.drzave) {
    // `redosled` is display order *within its country*, so it restarts here.
    let redosled = 0;
    for (const regija of drzava.regije) {
      for (const grad of regija.gradovi) {
        redovi.push({
          drzava: drzava.naziv,
          drzavaSifra: drzava.sifra,
          regija: regija.naziv,
          grad,
          // A country marked unavailable on the site makes every city in it
          // unavailable. There is no per-city flag in the source data.
          aktivna: drzava.aktivna,
          redosled: redosled++,
        });
      }
    }
  }

  const kljucevi = new Set<string>();
  for (const red of redovi) {
    const kljuc = `${red.drzavaSifra}|${red.regija}|${red.grad}`;
    if (kljucevi.has(kljuc)) {
      throw new Error(`Duplikat u destinacije.json: ${kljuc}`);
    }
    kljucevi.add(kljuc);
  }

  return redovi;
}
