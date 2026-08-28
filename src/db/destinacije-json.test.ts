import { describe, expect, it } from "vitest";
import { ucitajDestinacije } from "./destinacije-json";

const redovi = ucitajDestinacije();

describe("data/destinacije.json", () => {
  it("is 44 cities across 17 regions in 7 countries", () => {
    expect(redovi).toHaveLength(44);
    expect(new Set(redovi.map((r) => `${r.drzavaSifra}|${r.regija}`)).size).toBe(17);
    expect(new Set(redovi.map((r) => r.drzavaSifra)).size).toBe(7);
  });

  it("marks Slovenija and Bosna i Hercegovina inactive, everything else active", () => {
    const neaktivne = new Set(
      redovi.filter((r) => !r.aktivna).map((r) => r.drzavaSifra),
    );
    expect([...neaktivne].sort()).toEqual(["bih", "slovenija"]);
  });

  it("includes Beograd, which is not on the client's site", () => {
    expect(
      redovi.find(
        (r) => r.drzavaSifra === "srbija" && r.regija === "Beograd" && r.grad === "Beograd",
      ),
    ).toMatchObject({ drzava: "Srbija", aktivna: true });
  });

  it("keeps Kasandra's six towns apart — the dispatch reason for level three", () => {
    const kasandra = redovi.filter((r) => r.regija === "Kasandra").map((r) => r.grad);
    expect(kasandra.sort()).toEqual([
      "Afitos",
      "Hanioti",
      "Kalitea",
      "Pefkohori",
      "Polihrono",
      "Siviri",
    ]);
  });

  it("numbers redosled from zero within each country, with no gaps", () => {
    const poDrzavi = new Map<string, number[]>();
    for (const r of redovi) {
      poDrzavi.set(r.drzavaSifra, [...(poDrzavi.get(r.drzavaSifra) ?? []), r.redosled]);
    }
    for (const [sifra, redosledi] of poDrzavi) {
      expect(redosledi, sifra).toEqual(redosledi.map((_, i) => i));
    }
  });

  it("has exactly the nine single-city regions the spec names, plus Beograd", () => {
    const brojGradova = new Map<string, number>();
    for (const r of redovi) {
      const kljuc = `${r.drzavaSifra}|${r.regija}`;
      brojGradova.set(kljuc, (brojGradova.get(kljuc) ?? 0) + 1);
    }
    const jednogradne = redovi
      .filter((r) => brojGradova.get(`${r.drzavaSifra}|${r.regija}`) === 1)
      .map((r) => r.grad)
      .sort();

    // SPEC §5 lists nine; Beograd is the tenth because it was added by hand
    // after that sentence was written. The rule is "one city", not a list.
    expect(jednogradne).toEqual([
      "Beograd",
      "Jahorina",
      "Karlovac",
      "Kopaonik",
      "Ohrid",
      "Paralija",
      "Sarajevo",
      "Skoplje",
      "Trst",
      "Zagreb",
    ]);
  });

  it("has no duplicate seed keys", () => {
    const kljucevi = redovi.map((r) => `${r.drzavaSifra}|${r.regija}|${r.grad}`);
    expect(new Set(kljucevi).size).toBe(kljucevi.length);
  });
});
