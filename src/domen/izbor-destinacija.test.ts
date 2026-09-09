/**
 * The destination checkbox algebra.
 *
 * The cases that matter are the ones where a click on one level has to change
 * how another level reads: ticking a country must tick its cities, and
 * unticking one city must leave the rest of the country ticked without
 * leaving a stale country key behind.
 */
import { describe, expect, it } from "vitest";
import { stabloDestinacija } from "./destinacije";
import {
  gradoviCvora,
  jePokriven,
  prebaciCvor,
  razviIzbor,
  sazmiIzbor,
} from "./izbor-destinacija";
import {
  BEOGRAD,
  HANIOTI,
  KATALOG,
  KOPAONIK,
  LJUBLJANA,
  SARTI,
  SIVIRI,
  SOLUN,
  ZAGREB,
} from "./fiksture";

const stablo = stabloDestinacija(KATALOG);

const grad = (id: string) => `grad:${id}`;
const GRCKA = "drzava:grcka";
const KASANDRA = "regija:grcka|Kasandra";
const SRBIJA = "drzava:srbija";
const HRVATSKA = "drzava:hrvatska";

/** The fixture catalogue: Grčka has Kasandra (Hanioti, Siviri), Sitonija
 *  (Sarti) and Solun i okolina (Solun) — four cities across three regions. */
const SVI_GRCKI = [HANIOTI, SIVIRI, SARTI, SOLUN].map((d) => grad(d.id));

describe("razviIzbor", () => {
  it("expands a country into every city under it", () => {
    expect([...razviIzbor(stablo, [GRCKA])].sort()).toEqual(
      [...SVI_GRCKI].sort(),
    );
  });

  it("expands a region into only its own cities", () => {
    expect([...razviIzbor(stablo, [KASANDRA])].sort()).toEqual(
      [grad(HANIOTI.id), grad(SIVIRI.id)].sort(),
    );
  });

  it("leaves a city key as itself", () => {
    expect([...razviIzbor(stablo, [grad(SARTI.id)])]).toEqual([grad(SARTI.id)]);
  });

  it("unions overlapping selections rather than double-counting", () => {
    expect(
      [...razviIzbor(stablo, [GRCKA, KASANDRA, grad(HANIOTI.id)])].sort(),
    ).toEqual([...SVI_GRCKI].sort());
  });

  it("drops a key that matches nothing — filter state outlives a re-seed", () => {
    expect([...razviIzbor(stablo, ["drzava:atlantida", "smece"])]).toEqual([]);
  });
});

describe("sazmiIzbor", () => {
  it("collapses every city of a country back to the country key", () => {
    expect(sazmiIzbor(stablo, new Set(SVI_GRCKI))).toEqual([GRCKA]);
  });

  it("collapses a full region without claiming the whole country", () => {
    const gradovi = new Set([grad(HANIOTI.id), grad(SIVIRI.id)]);
    expect(sazmiIzbor(stablo, gradovi)).toEqual([KASANDRA]);
  });

  it("leaves a partial region as individual cities", () => {
    expect(sazmiIzbor(stablo, new Set([grad(HANIOTI.id)]))).toEqual([
      grad(HANIOTI.id),
    ]);
  });

  it("is the inverse of razviIzbor for any normalised selection", () => {
    for (const izbor of [
      [GRCKA],
      [KASANDRA],
      [grad(HANIOTI.id)],
      [KASANDRA, HRVATSKA],
      [GRCKA, SRBIJA],
    ]) {
      expect(sazmiIzbor(stablo, razviIzbor(stablo, izbor)).sort()).toEqual(
        [...izbor].sort(),
      );
    }
  });

  it("a country holding one city collapses to the country key", () => {
    // Hrvatska is Zagreb and nothing else in the fixtures. Ticking the city
    // and ticking the country are then the same selection, and the shortest
    // spelling of it wins — the same rule that hides a single-city region's
    // third dropdown in the form.
    expect(sazmiIzbor(stablo, new Set([grad(ZAGREB.id)]))).toEqual([HRVATSKA]);
  });

  it("an empty selection collapses to nothing, not to every country", () => {
    expect(sazmiIzbor(stablo, new Set())).toEqual([]);
  });
});

describe("prebaciCvor", () => {
  it("ticking a country selects it as one key, not seventeen", () => {
    expect(prebaciCvor(stablo, [], GRCKA)).toEqual([GRCKA]);
  });

  it("ticking every city of a region collapses into the region", () => {
    const jedan = prebaciCvor(stablo, [], grad(HANIOTI.id));
    expect(jedan).toEqual([grad(HANIOTI.id)]);
    expect(prebaciCvor(stablo, jedan, grad(SIVIRI.id))).toEqual([KASANDRA]);
  });

  /*
   * SPEC §3, amended 09.09.2026. These two used to assert the opposite — that
   * a tap inside a ticked country *subtracted* that place and kept the rest,
   * the way a checkbox tree behaves. The owner reported it as the bug it felt
   * like: he ticked Grčka, tapped Sitonija meaning "just Sitonija", and
   * watched every other Greek region stay lit.
   */
  it("tapping inside a ticked country narrows to what was tapped", () => {
    const posle = prebaciCvor(stablo, [GRCKA], grad(SARTI.id));
    expect(posle).not.toContain(GRCKA);
    expect([...razviIzbor(stablo, posle)]).toEqual([grad(SARTI.id)]);
  });

  it("narrows to a region the same way, and only inside its own country", () => {
    const posle = prebaciCvor(stablo, [GRCKA, HRVATSKA], KASANDRA);
    // Grčka collapses to Kasandra; Hrvatska was a separate answer and stands.
    expect([...razviIzbor(stablo, posle)].sort()).toEqual(
      [grad(HANIOTI.id), grad(SIVIRI.id), grad(ZAGREB.id)].sort(),
    );
  });

  it("tapping it again turns it off — nothing above it is on any more", () => {
    const samoKasandra = prebaciCvor(stablo, [GRCKA], KASANDRA);
    expect(prebaciCvor(stablo, samoKasandra, KASANDRA)).toEqual([]);
  });

  /*
   * Sarti is the only town of Sitonija in the fixtures, so narrowing Sitonija
   * to Sarti removes nothing — the two keys are the same selection spelled
   * differently. Without the "narrow only where it reduces" guard this chip
   * could be ticked and never unticked again, which is how the rule first
   * failed when it was written.
   */
  it("a place that is its own region can still be turned off", () => {
    const samoSarti = prebaciCvor(stablo, [GRCKA], grad(SARTI.id));
    expect([...razviIzbor(stablo, samoSarti)]).toEqual([grad(SARTI.id)]);
    expect(prebaciCvor(stablo, samoSarti, grad(SARTI.id))).toEqual([]);
  });

  it("a single-city country behaves the same", () => {
    // Hrvatska is Zagreb and nothing else in the fixtures.
    const posle = prebaciCvor(stablo, [HRVATSKA], grad(ZAGREB.id));
    expect(posle).toEqual([]);
  });

  it("narrowing does not fire when no ancestor is ticked", () => {
    // Two regions picked by hand: tapping one of them subtracts it, because
    // nothing above it was ever ticked to narrow out of.
    const dve = prebaciCvor(stablo, [KASANDRA], grad(SARTI.id));
    const posle = prebaciCvor(stablo, dve, KASANDRA);
    expect([...razviIzbor(stablo, posle)]).toEqual([grad(SARTI.id)]);
  });

  it("unticking a ticked country clears it entirely", () => {
    expect(prebaciCvor(stablo, [GRCKA], GRCKA)).toEqual([]);
  });

  it("touching one country leaves another alone", () => {
    const posle = prebaciCvor(stablo, [GRCKA, HRVATSKA], GRCKA);
    expect(posle).toEqual([HRVATSKA]);
  });

  it("an unknown key is ignored rather than throwing", () => {
    expect(prebaciCvor(stablo, [GRCKA], "grad:nepostojeci")).toEqual([GRCKA]);
  });

  it("an inactive destination is still selectable when it is in the tree", () => {
    // SPEC §5: Ljubljana is hidden from the dropdowns but stays in the filter
    // for as long as a booking points at it.
    expect(prebaciCvor(stablo, [], grad(LJUBLJANA.id))).toEqual([
      "drzava:slovenija",
    ]);
  });
});

describe("jePokriven / gradoviCvora", () => {
  it("a country reads as ticked once its last city is ticked individually", () => {
    const izbor = [grad(BEOGRAD.id)];
    const gradovi = razviIzbor(stablo, izbor);
    expect(jePokriven(gradoviCvora(stablo, SRBIJA), gradovi)).toBe(false);

    const oba = razviIzbor(stablo, [...izbor, grad(KOPAONIK.id)]);
    expect(jePokriven(gradoviCvora(stablo, SRBIJA), oba)).toBe(true);
  });

  it("an empty node is never covered", () => {
    expect(jePokriven(gradoviCvora(stablo, "drzava:nema"), new Set())).toBe(
      false,
    );
  });
});
