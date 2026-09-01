import { describe, expect, it } from "vitest";
import {
  BEOGRAD,
  HANIOTI,
  KATALOG,
  LJUBLJANA,
  SARTI,
  SIVIRI,
  SOLUN,
  SVI,
  ZAGREB,
} from "./fiksture";
import {
  destinacijeIzRedova,
  destinacijeZaFilter,
  kljucDrzave,
  kljucGrada,
  kljucRegije,
  razresiDestinacije,
  stabloDestinacija,
} from "./destinacije";

const ids = (skup: ReadonlySet<string>) => [...skup].sort();
const gradovi = (skup: ReadonlySet<string>) =>
  KATALOG.filter((d) => skup.has(d.id))
    .map((d) => d.grad)
    .sort();

describe("razresiDestinacije — the rollup, SPEC §5", () => {
  it("a country matches every city in it (Grčka → Hanioti)", () => {
    const skup = razresiDestinacije([kljucDrzave(HANIOTI)], KATALOG);
    expect(gradovi(skup)).toEqual(["Hanioti", "Sarti", "Siviri", "Solun"]);
    expect(skup.has(HANIOTI.id)).toBe(true);
    expect(skup.has(BEOGRAD.id)).toBe(false);
  });

  it("a region matches only its own cities (Kasandra → Hanioti and Siviri, not Sarti)", () => {
    const skup = razresiDestinacije([kljucRegije(HANIOTI)], KATALOG);
    expect(gradovi(skup)).toEqual(["Hanioti", "Siviri"]);
    expect(skup.has(SARTI.id)).toBe(false);
    expect(skup.has(SOLUN.id)).toBe(false);
  });

  it("a city matches exactly itself", () => {
    const skup = razresiDestinacije([kljucGrada(HANIOTI)], KATALOG);
    expect(ids(skup)).toEqual([HANIOTI.id]);
  });

  it("several selections OR together", () => {
    const skup = razresiDestinacije(
      [kljucGrada(BEOGRAD), kljucRegije(HANIOTI)],
      KATALOG,
    );
    expect(gradovi(skup)).toEqual(["Beograd", "Hanioti", "Siviri"]);
  });

  it("a region key is scoped to its country", () => {
    // Two countries could both have a region called `Beograd`; the key carries
    // the country code so ticking one cannot pull in the other.
    const dvojnik = {
      ...ZAGREB,
      id: "00000000-0000-4000-8000-2000000000ff",
      drzava: "Srbija",
      drzavaSifra: "srbija",
      regija: "Zagreb",
    };
    const skup = razresiDestinacije([kljucRegije(ZAGREB)], [...KATALOG, dvojnik]);
    expect(ids(skup)).toEqual([ZAGREB.id]);
  });

  it("no selection resolves to nothing (the caller treats empty as no filter)", () => {
    expect(razresiDestinacije([], KATALOG).size).toBe(0);
  });

  it("ignores a stale or malformed key rather than throwing", () => {
    // Filter state travels through the URL; a bad key must not crash the list.
    const skup = razresiDestinacije(["drzava:grcka", "smece", "grad:"], KATALOG);
    expect(gradovi(skup)).toEqual(["Hanioti", "Sarti", "Siviri", "Solun"]);
  });

  it("matches an inactive destination just as well as an active one", () => {
    const skup = razresiDestinacije([kljucDrzave(LJUBLJANA)], KATALOG);
    expect(ids(skup)).toEqual([LJUBLJANA.id]);
  });
});

describe("the one canonical list", () => {
  it("a place appears once however many columns reference it", () => {
    // Beograd is the outbound destination of #5 and the return of all the
    // others. One entry, not two.
    const list = destinacijeIzRedova(SVI);
    expect(list.filter((d) => d.grad === "Beograd")).toHaveLength(1);
  });

  it("collects destinations from BOTH columns", () => {
    const list = destinacijeIzRedova(SVI).map((d) => d.grad);
    expect(list).toContain("Beograd"); // outbound on #5, return everywhere else
    expect(list).toContain("Hanioti"); // outbound only
    expect(list).toContain("Zagreb"); // outbound of the booking with no return
  });

  it("the filter list is everything offerable, plus anything a booking uses", () => {
    // Ljubljana is inactive — absent from the new-booking dropdowns, but #7
    // points at it, so it must stay in the filter (SPEC §5).
    const bezRezervacija = destinacijeZaFilter(KATALOG, []).map((d) => d.grad);
    expect(bezRezervacija).not.toContain("Ljubljana");

    const saRezervacijama = destinacijeZaFilter(KATALOG, SVI).map((d) => d.grad);
    expect(saRezervacijama).toContain("Ljubljana");
    expect(saRezervacijama.filter((g) => g === "Ljubljana")).toHaveLength(1);
  });

  it("is sorted country, region, city through the sr-Latn collator", () => {
    const list = destinacijeZaFilter(KATALOG, SVI);
    expect(list.map((d) => `${d.drzava}/${d.grad}`)).toEqual([
      "Grčka/Hanioti",
      "Grčka/Siviri",
      "Grčka/Sarti",
      "Grčka/Solun",
      "Hrvatska/Zagreb",
      "Slovenija/Ljubljana",
      "Srbija/Beograd",
      "Srbija/Kopaonik",
    ]);
  });
});

describe("stabloDestinacija — the checkbox tree, grouped by country", () => {
  const stablo = stabloDestinacija(destinacijeZaFilter(KATALOG, SVI));

  it("groups by country and nothing else — never trip versus home", () => {
    expect(stablo.map((d) => d.naziv)).toEqual([
      "Grčka",
      "Hrvatska",
      "Slovenija",
      "Srbija",
    ]);
    // Beograd sits under Srbija like any other place, in exactly one branch.
    const srbija = stablo.find((d) => d.sifra === "srbija")!;
    expect(srbija.regije.flatMap((r) => r.gradovi.map((g) => g.naziv))).toEqual([
      "Beograd",
      "Kopaonik",
    ]);
  });

  it("carries the three levels of keys the filter selects on", () => {
    const grcka = stablo[0];
    expect(grcka.kljuc).toBe("drzava:grcka");
    const kasandra = grcka.regije.find((r) => r.naziv === "Kasandra")!;
    expect(kasandra.kljuc).toBe("regija:grcka|Kasandra");
    expect(kasandra.gradovi.map((g) => g.naziv)).toEqual(["Hanioti", "Siviri"]);
    expect(kasandra.gradovi[0].kljuc).toBe(`grad:${HANIOTI.id}`);
  });

  it("marks inactive cities so the UI can label them", () => {
    const slovenija = stablo.find((d) => d.sifra === "slovenija")!;
    expect(slovenija.regije[0].gradovi[0]).toMatchObject({
      naziv: "Ljubljana",
      aktivna: false,
    });
  });

  it("orders regions and cities A–Z, Serbian collation", () => {
    const grcka = stablo[0];
    expect(grcka.regije.map((r) => r.naziv)).toEqual([
      "Kasandra",
      "Sitonija",
      "Solun i okolina",
    ]);
    expect(grcka.regije[0].gradovi.map((g) => g.naziv)).toEqual([
      "Hanioti",
      "Siviri",
    ]);
    expect(SIVIRI.redosled).toBeGreaterThan(HANIOTI.redosled);
  });
});
