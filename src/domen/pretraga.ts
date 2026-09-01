/**
 * Search over name, phone and destination — SPEC §3.
 *
 * Search is not just a faster filter: it is the **only** way to reach a
 * booking that has no main date (departed, no return date agreed), so it
 * deliberately searches the whole reservation rather than a resolved leg, and
 * it looks at both destinations.
 *
 * Two normalisations make it behave the way a phone user expects:
 *
 *   - Diacritics fold, so `saban` finds `Šaban` and `djordjevic`'s more common
 *     spelling `dordevic` finds `Đorđević`. Typing `Š` on a phone keyboard is
 *     work nobody should have to do to find a booking.
 *   - Phone numbers are compared as digits with the country prefix stripped
 *     from both sides, so `064 123` finds `+381641234567`.
 */
import type { RezervacijaRed } from "./tipovi";

export type Upit = {
  /** Whitespace-separated tokens, folded and lower-cased. */
  reci: string[];
  /**
   * The same tokens as bare digits, prefix-stripped, **index-aligned** with
   * `reci`. A token with no digits in it yields `""`.
   */
  cifre: string[];
};

/**
 * Fold to a comparable form: lower case, no diacritics.
 *
 * `Đ`/`đ` has no canonical decomposition, so NFD alone will not touch it — it
 * is mapped by hand. Č Ć Š Ž all decompose and are handled by stripping the
 * combining marks.
 */
export function normalizujZaPretragu(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

/**
 * Digits only, with the Serbian prefix taken off either form, so the stored
 * `+381641234567` and the typed `064 123 4567` reduce to the same `641234567`.
 */
export function normalizujCifre(tekst: string): string {
  const cifre = tekst.replace(/\D/g, "");
  if (cifre.startsWith("381")) return cifre.slice(3);
  return cifre.replace(/^0+/, "");
}

/** `null` when there is nothing to search for. */
export function pripremiUpit(upit: string | null | undefined): Upit | null {
  if (!upit) return null;
  const reci = normalizujZaPretragu(upit).split(/\s+/).filter(Boolean);
  if (reci.length === 0) return null;
  return { reci, cifre: reci.map(normalizujCifre) };
}

/** Everything about a booking that search should look at, folded, in one string. */
function senoZaPretragu(red: RezervacijaRed): string {
  const { rezervacija: r, destinacija: d, destinacijaPovratka: p } = red;
  return normalizujZaPretragu(
    [
      r.ime,
      r.telefon,
      d.grad,
      d.regija,
      d.drzava,
      p.grad,
      p.regija,
      p.drzava,
    ].join(" "),
  );
}

/**
 * Every token must match something (AND across tokens), and a token may match
 * any field (OR across fields). "marko petrovic" narrows; "marko" alone does
 * not have to be the whole name.
 */
export function prolaziPretragu(
  red: RezervacijaRed,
  upit: Upit | null,
): boolean {
  if (upit === null) return true;

  const seno = senoZaPretragu(red);
  const telefon = normalizujCifre(red.rezervacija.telefon);

  return upit.reci.every((rec, i) => {
    if (seno.includes(rec)) return true;
    const cifre = upit.cifre[i];
    return cifre !== undefined && cifre !== "" && telefon.includes(cifre);
  });
}

/**
 * Raw search over reservations, ignoring dates entirely.
 *
 * Used by the search list mode, which must be able to surface a booking that
 * has no main leg at all.
 */
export function pretraziRezervacije(
  redovi: readonly RezervacijaRed[],
  upit: string | null | undefined,
): RezervacijaRed[] {
  const pripremljen = pripremiUpit(upit);
  return redovi.filter((red) => prolaziPretragu(red, pripremljen));
}
