/**
 * The three cascading dropdowns of the reservation form — SPEC §5.
 *
 * Država → Regija → Grad, and the third level is not decoration: "Kasandra" is
 * a peninsula with six towns, and dropping a family at Hanioti rather than
 * Siviri is forty minutes of driving. The region alone does not tell the
 * driver where to go.
 *
 * **These lists are ordered by `redosled`, not alphabetically.** That is the
 * one place the two orderings in this app differ, and it is deliberate:
 * `redosled` is the client's own display order from their site, which puts the
 * destinations they actually sell near the top, and this is the dropdown where
 * that matters. The *filter* tree in `destinacije.ts` sorts A–Z instead,
 * because forty-odd entries scanned by eye want to be alphabetical. Countries
 * have no order column of their own, so they stay alphabetical here too.
 *
 * What may be offered is the caller's decision, not this file's: SPEC §5 hides
 * inactive destinations from the dropdowns but requires an existing booking
 * that points at one to keep rendering, so the form passes in the active rows
 * *plus* whatever the reservation being edited already references.
 */
import { uporediTekst } from "@/lib/tekst";
import type { Destinacija } from "./tipovi";

export type OpcijaDrzave = { sifra: string; naziv: string };
export type OpcijaGrada = { id: string; naziv: string };

/** `redosled` first, name as the tiebreak so the order is always total. */
function poRedosledu(a: Destinacija, b: Destinacija): number {
  return a.redosled - b.redosled || uporediTekst(a.grad, b.grad);
}

/** Every country present in the catalogue, alphabetically. */
export function drzaveZaFormu(
  katalog: readonly Destinacija[],
): OpcijaDrzave[] {
  const poSifri = new Map<string, string>();
  for (const d of katalog) poSifri.set(d.drzavaSifra, d.drzava);
  return [...poSifri.entries()]
    .map(([sifra, naziv]) => ({ sifra, naziv }))
    .sort((a, b) => uporediTekst(a.naziv, b.naziv));
}

/**
 * The regions of one country, in the order that country's cities are listed.
 *
 * A region is ranked by its lowest-numbered city, so a region containing the
 * client's headline destination comes first — which is what `redosled` was
 * recording in the first place.
 */
export function regijeZaFormu(
  katalog: readonly Destinacija[],
  sifra: string,
): string[] {
  const najmanji = new Map<string, number>();
  for (const d of katalog) {
    if (d.drzavaSifra !== sifra) continue;
    const trenutni = najmanji.get(d.regija);
    if (trenutni === undefined || d.redosled < trenutni) {
      najmanji.set(d.regija, d.redosled);
    }
  }
  return [...najmanji.entries()]
    .sort((a, b) => a[1] - b[1] || uporediTekst(a[0], b[0]))
    .map(([naziv]) => naziv);
}

/** The cities of one region, in the client's order. */
export function gradoviZaFormu(
  katalog: readonly Destinacija[],
  sifra: string,
  regija: string,
): OpcijaGrada[] {
  return katalog
    .filter((d) => d.drzavaSifra === sifra && d.regija === regija)
    .sort(poRedosledu)
    .map((d) => ({ id: d.id, naziv: d.grad }));
}

/**
 * What the form should offer, given what it is editing.
 *
 * The active rows, plus any destination the reservation already points at even
 * if it has since been deactivated — otherwise opening an old Ljubljana
 * booking would silently drop its destination the moment it was saved
 * (SPEC §5, "Inactive destinations must still resolve").
 */
export function katalogZaFormu(
  sve: readonly Destinacija[],
  zadrzi: readonly (string | null | undefined)[] = [],
): Destinacija[] {
  const obavezni = new Set(zadrzi.filter((id): id is string => !!id));
  return sve.filter((d) => d.aktivna || obavezni.has(d.id));
}
