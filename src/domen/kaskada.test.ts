/**
 * The form's dropdown lists.
 *
 * The case that matters most is the last one: an inactive destination is
 * hidden from a new booking but must survive editing an old one.
 */
import { describe, expect, it } from "vitest";
import {
  drzaveZaFormu,
  gradoviZaFormu,
  katalogZaFormu,
  regijeZaFormu,
} from "./kaskada";
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

describe("drzaveZaFormu", () => {
  it("lists each country once, alphabetically", () => {
    expect(drzaveZaFormu(KATALOG).map((d) => d.naziv)).toEqual([
      "Grčka",
      "Hrvatska",
      "Slovenija",
      "Srbija",
    ]);
  });

  it("carries the stable code, not just the display name", () => {
    expect(drzaveZaFormu(KATALOG).map((d) => d.sifra)).toContain("grcka");
  });
});

describe("regijeZaFormu", () => {
  it("orders regions by the client's own redosled, not alphabetically", () => {
    // Solun i okolina leads with redosled 0, Sitonija (Sarti, 4) next, then
    // Kasandra (Hanioti, 10). Alphabetically it would be the other way round.
    expect(regijeZaFormu(KATALOG, "grcka")).toEqual([
      "Solun i okolina",
      "Sitonija",
      "Kasandra",
    ]);
  });

  it("returns nothing for a country that is not in the catalogue", () => {
    expect(regijeZaFormu(KATALOG, "atlantida")).toEqual([]);
  });
});

describe("gradoviZaFormu", () => {
  it("orders cities within a region by redosled", () => {
    expect(gradoviZaFormu(KATALOG, "grcka", "Kasandra").map((g) => g.naziv)).toEqual([
      HANIOTI.grad,
      SIVIRI.grad,
    ]);
  });

  it("does not leak cities of another region", () => {
    const gradovi = gradoviZaFormu(KATALOG, "grcka", "Kasandra");
    expect(gradovi.map((g) => g.naziv)).not.toContain(SARTI.grad);
  });

  it("a single-city region yields exactly one option — the hide rule's input", () => {
    expect(gradoviZaFormu(KATALOG, "grcka", "Solun i okolina")).toEqual([
      { id: SOLUN.id, naziv: SOLUN.grad },
    ]);
    expect(gradoviZaFormu(KATALOG, "hrvatska", "Zagreb")).toHaveLength(1);
  });
});

describe("katalogZaFormu", () => {
  it("hides inactive destinations from a new booking", () => {
    const katalog = katalogZaFormu(KATALOG);
    expect(katalog).not.toContainEqual(LJUBLJANA);
    expect(katalog).toContainEqual(HANIOTI);
  });

  it("keeps an inactive destination the booking being edited points at", () => {
    const katalog = katalogZaFormu(KATALOG, [LJUBLJANA.id, BEOGRAD.id]);
    expect(katalog).toContainEqual(LJUBLJANA);
    // Slovenija is then offerable in the cascade for this one booking.
    expect(drzaveZaFormu(katalog).map((d) => d.naziv)).toContain("Slovenija");
  });

  it("ignores a null or absent id rather than choking on it", () => {
    // A new booking has no return date and no second destination yet.
    expect(katalogZaFormu(KATALOG, [null, undefined])).not.toContainEqual(
      LJUBLJANA,
    );
  });

  it("does not duplicate a destination that is both active and referenced", () => {
    const katalog = katalogZaFormu(KATALOG, [KOPAONIK.id, ZAGREB.id]);
    expect(katalog.filter((d) => d.id === ZAGREB.id)).toHaveLength(1);
  });
});
