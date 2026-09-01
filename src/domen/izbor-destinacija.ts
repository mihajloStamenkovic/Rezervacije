/**
 * The algebra behind the destination checkboxes — SPEC §3 and §5.
 *
 * A checkbox can sit on a country, a region or a city, and ticking one must
 * mean "everything under it". That is easy to render and surprisingly easy to
 * get wrong when the user then unticks *one* city inside a ticked country, so
 * the whole thing is expressed as one round trip rather than as ad-hoc cases:
 *
 *   1. **Expand** the current selection to the set of city keys it covers.
 *      City keys are the ground truth; a country key is only ever shorthand.
 *   2. **Toggle** every city under the node that was clicked, on or off.
 *   3. **Collapse** back to the shortest equivalent selection — a country key
 *      when all of its cities are in, a region key when all of a region's are.
 *
 * Collapsing is not cosmetic. The selection is serialised into the URL and
 * counted by `brojAktivnihFiltera` for the badge, so without step 3 ticking
 * `Grčka` would read as seventeen filters and produce a URL to match.
 *
 * This lives in the domain rather than in the filter sheet because it is
 * filter logic, and it is the kind of logic that is only ever verified by
 * tests — no component should be reimplementing it.
 */
import type { CvorDrzave, CvorRegije } from "./destinacije";

/** Every city key under a region. */
function gradoviRegije(regija: CvorRegije): string[] {
  return regija.gradovi.map((g) => g.kljuc);
}

/** Every city key under a country. */
function gradoviDrzave(drzava: CvorDrzave): string[] {
  return drzava.regije.flatMap(gradoviRegije);
}

/**
 * Step 1 — the selection as a flat set of city keys.
 *
 * Keys that no longer match anything in the tree are dropped rather than
 * carried, which is the same forgiveness `razresiDestinacije` shows: filter
 * state outlives a re-seed, and a destination that was renamed away must not
 * pin a phantom entry in the badge count.
 */
export function razviIzbor(
  stablo: readonly CvorDrzave[],
  izbor: readonly string[],
): Set<string> {
  const izabrano = new Set(izbor);
  const gradovi = new Set<string>();

  for (const drzava of stablo) {
    const svaDrzava = izabrano.has(drzava.kljuc);
    for (const regija of drzava.regije) {
      const svaRegija = svaDrzava || izabrano.has(regija.kljuc);
      for (const grad of regija.gradovi) {
        if (svaRegija || izabrano.has(grad.kljuc)) gradovi.add(grad.kljuc);
      }
    }
  }
  return gradovi;
}

/**
 * Step 3 — the shortest selection covering exactly this set of cities.
 *
 * Deliberately not the reverse of `razviIzbor` for empty groups: a country
 * with no cities cannot occur in a tree built from real rows, and treating a
 * vacuous "all" as selected would tick empty countries.
 */
export function sazmiIzbor(
  stablo: readonly CvorDrzave[],
  gradovi: ReadonlySet<string>,
): string[] {
  const kljucevi: string[] = [];

  for (const drzava of stablo) {
    const sviGradovi = gradoviDrzave(drzava);
    if (sviGradovi.length > 0 && sviGradovi.every((k) => gradovi.has(k))) {
      kljucevi.push(drzava.kljuc);
      continue;
    }

    for (const regija of drzava.regije) {
      const gradoviR = gradoviRegije(regija);
      if (gradoviR.length > 0 && gradoviR.every((k) => gradovi.has(k))) {
        kljucevi.push(regija.kljuc);
        continue;
      }
      for (const k of gradoviR) if (gradovi.has(k)) kljucevi.push(k);
    }
  }

  return kljucevi;
}

/**
 * Is this node ticked? True when every city under it is covered — so a
 * country reads as ticked once its last city is, however the selection got
 * there. A city node is just the one-city case.
 */
export function jePokriven(
  kljucevi: readonly string[],
  gradovi: ReadonlySet<string>,
): boolean {
  return kljucevi.length > 0 && kljucevi.every((k) => gradovi.has(k));
}

/** The city keys a node covers, whichever level it sits on. */
export function gradoviCvora(
  stablo: readonly CvorDrzave[],
  kljuc: string,
): string[] {
  for (const drzava of stablo) {
    if (drzava.kljuc === kljuc) return gradoviDrzave(drzava);
    for (const regija of drzava.regije) {
      if (regija.kljuc === kljuc) return gradoviRegije(regija);
      for (const grad of regija.gradovi) {
        if (grad.kljuc === kljuc) return [grad.kljuc];
      }
    }
  }
  return [];
}

/**
 * Tick or untick any node, returning the new normalised selection.
 *
 * Unticking one city inside a ticked country therefore leaves the country's
 * other cities selected — the country key expands into its remainder — which
 * is what a checkbox tree is expected to do and what makes the control
 * reversible: tick the city again and the country key comes back.
 */
export function prebaciCvor(
  stablo: readonly CvorDrzave[],
  izbor: readonly string[],
  kljuc: string,
): string[] {
  const gradovi = razviIzbor(stablo, izbor);
  const ciljani = gradoviCvora(stablo, kljuc);
  if (ciljani.length === 0) return [...izbor];

  if (jePokriven(ciljani, gradovi)) {
    for (const k of ciljani) gradovi.delete(k);
  } else {
    for (const k of ciljani) gradovi.add(k);
  }

  return sazmiIzbor(stablo, gradovi);
}
