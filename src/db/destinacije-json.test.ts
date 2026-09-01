import { describe, expect, it } from "vitest";
import { ucitajDestinacije } from "./destinacije-json";

const redovi = ucitajDestinacije();

describe("data/destinacije.json", () => {
  it("is 67 cities across 40 regions in 7 countries", () => {
    // 44 captured from eurotravel.rs on 27.08.2026, plus Beograd, plus the 23
    // largest Serbian towns added by hand on 01.09.2026 as pickup points.
    // These numbers are a drift alarm: if the client edits their site and the
    // file is re-captured, this test should fail and be updated deliberately.
    expect(redovi).toHaveLength(67);
    expect(new Set(redovi.map((r) => `${r.drzavaSifra}|${r.regija}`)).size).toBe(40);
    expect(new Set(redovi.map((r) => r.drzavaSifra)).size).toBe(7);
  });

  it("has 25 Serbian pickup points, with Beograd first in the dropdown", () => {
    const srbija = redovi.filter((r) => r.drzavaSifra === "srbija");
    expect(srbija).toHaveLength(25);
    // 99% of rides start in Belgrade, so redosled 0 is not decoration.
    expect(srbija.find((r) => r.redosled === 0)?.grad).toBe("Beograd");
    for (const grad of ["Novi Sad", "Niš", "Kragujevac", "Subotica", "Vranje"]) {
      expect(srbija.map((r) => r.grad)).toContain(grad);
    }
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

  it("keeps every region SPEC §5 names as single-city single-city", () => {
    // The form auto-selects and hides the third dropdown for these. SPEC §5
    // names nine and says to implement the rule rather than the list, which
    // is why this asserts they are all still single-city instead of pinning
    // the set — the set grew to 33 the day the Serbian pickup towns landed.
    const brojGradova = new Map<string, number>();
    for (const r of redovi) {
      const kljuc = `${r.drzavaSifra}|${r.regija}`;
      brojGradova.set(kljuc, (brojGradova.get(kljuc) ?? 0) + 1);
    }
    const jednogradne = new Set(
      redovi
        .filter((r) => brojGradova.get(`${r.drzavaSifra}|${r.regija}`) === 1)
        .map((r) => r.grad),
    );

    for (const grad of [
      "Beograd", "Jahorina", "Karlovac", "Kopaonik", "Ohrid",
      "Paralija", "Sarajevo", "Skoplje", "Trst", "Zagreb",
    ]) {
      expect(jednogradne.has(grad), grad).toBe(true);
    }
    // Every hand-added Serbian pickup town is its own one-city region too.
    expect(jednogradne.has("Novi Sad")).toBe(true);
    expect(jednogradne.has("Niš")).toBe(true);

    // And a multi-city region must never be mistaken for one.
    expect(jednogradne.has("Hanioti")).toBe(false);
  });

  it("has no duplicate seed keys", () => {
    const kljucevi = redovi.map((r) => `${r.drzavaSifra}|${r.regija}|${r.grad}`);
    expect(new Set(kljucevi).size).toBe(kljucevi.length);
  });
});
