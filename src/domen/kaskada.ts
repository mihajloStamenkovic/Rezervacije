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
import { normalizujZaPretragu } from "./pretraga";
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

/**
 * Every city of one country, in the client's order, ignoring regions.
 *
 * The **Povratak** leg uses this instead of the three-level cascade — the
 * owner's request, 06.09.2026. The return end of a trip is Beograd on about 99%
 * of bookings, so asking which region Beograd is in is a tap that buys nothing.
 * Regions still exist in the data and still matter on the outbound leg, where
 * knowing whether a family goes to Hanioti or Siviri is forty minutes of
 * driving.
 */
export function gradoviDrzaveZaFormu(
  katalog: readonly Destinacija[],
  sifra: string,
): OpcijaGrada[] {
  return katalog
    .filter((d) => d.drzavaSifra === sifra)
    .sort(poRedosledu)
    .map((d) => ({ id: d.id, naziv: d.grad }));
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

/**
 * A place typed by hand — SPEC §5, amended 06.09.2026.
 *
 * The country is never typed: all seven are already in the table, and letting
 * `Grcka` be entered next to `Grčka` would split the filter's canonical list
 * in two. Region and city are typed, and both are matched against what is
 * already there before anything new is created.
 */
export type NovoMesto = { drzavaSifra: string; regija: string; grad: string };

/**
 * Fold a typed name to something comparable: no diacritics, no case, no
 * double spaces.
 *
 * This is the whole defence against the list filling up with near-duplicates.
 * `Novi Marmaras`, `novi marmaras` and `Novi  Marmaras` must all resolve to
 * one row, or the destination filter grows two entries for one town and a
 * booking filed under the wrong one goes missing from the other.
 */
export function kljucNaziva(tekst: string): string {
  return normalizujZaPretragu(tekst).replace(/\s+/g, " ");
}

/**
 * The catalogue row a typed place already is, or `null` when it is genuinely
 * new.
 *
 * Matches inactive rows too. Typing `Ljubljana` is an explicit request for
 * Ljubljana, and answering it with "that destination is no longer offered"
 * when the owner has just spelled it out would be a dead end with no way past
 * it. `aktivna = false` hides a place from the dropdowns; it was never meant
 * to make it unbookable (SPEC §5).
 */
export function nadjiMesto(
  katalog: readonly Destinacija[],
  mesto: NovoMesto,
): Destinacija | null {
  const drzava = kljucNaziva(mesto.drzavaSifra);
  const regija = kljucNaziva(mesto.regija);
  const grad = kljucNaziva(mesto.grad);
  return (
    katalog.find(
      (d) =>
        kljucNaziva(d.drzavaSifra) === drzava &&
        kljucNaziva(d.regija) === regija &&
        kljucNaziva(d.grad) === grad,
    ) ?? null
  );
}

/**
 * A town looked up by country and name alone, ignoring which region it sits in.
 *
 * This is what the **Povratak** leg needs. It has no region field, so a town
 * typed there arrives with no region at all — and matching it as if its region
 * were its own name would miss `Grčka › Kasandra › Hanioti` entirely and create
 * a second Hanioti. "Which region is it in" is precisely the question that leg
 * does not ask, so the match must not depend on the answer.
 *
 * Ordered by `redosled` at the call site, so if a name somehow exists twice in
 * one country the client's preferred row is the one that wins.
 */
export function nadjiGradUDrzavi(
  katalog: readonly Destinacija[],
  drzavaSifra: string,
  grad: string,
): Destinacija | null {
  const trazeni = kljucNaziva(grad);
  const svoji = katalog
    .filter((d) => d.drzavaSifra === drzavaSifra)
    .sort((a, b) => a.redosled - b.redosled);
  return svoji.find((d) => kljucNaziva(d.grad) === trazeni) ?? null;
}

/**
 * The spelling this country already uses for a typed region, or the typed text
 * when the region is new.
 *
 * A new town in Kasandra must land in `Kasandra`, not in a second region
 * called `kasandra` that groups separately everywhere it is displayed.
 */
export function uskladiRegiju(
  katalog: readonly Destinacija[],
  drzavaSifra: string,
  regija: string,
): string {
  const trazeni = kljucNaziva(regija);
  const postojeca = katalog.find(
    (d) => d.drzavaSifra === drzavaSifra && kljucNaziva(d.regija) === trazeni,
  );
  return postojeca?.regija ?? regija.trim();
}

/**
 * Where a newly typed place sorts within its country: after everything already
 * there.
 *
 * `redosled` is the client's own display order from their site (see the note
 * at the top of this file), and a town the owner typed at 22:00 has no place
 * in it. Last is the honest answer.
 */
export function sledeciRedosled(
  katalog: readonly Destinacija[],
  drzavaSifra: string,
): number {
  const svoji = katalog.filter((d) => d.drzavaSifra === drzavaSifra);
  if (svoji.length === 0) return 0;
  return Math.max(...svoji.map((d) => d.redosled)) + 1;
}
