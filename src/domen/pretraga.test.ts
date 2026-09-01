import { describe, expect, it } from "vitest";
import { R1, R4, R6, R7, SVI } from "./fiksture";
import {
  normalizujCifre,
  normalizujZaPretragu,
  pretraziRezervacije,
  pripremiUpit,
  prolaziPretragu,
} from "./pretraga";

const imena = (redovi: typeof SVI) => redovi.map((r) => r.rezervacija.ime).sort();

describe("normalisation", () => {
  it("folds every Serbian diacritic, including đ", () => {
    // Č Ć Š Ž decompose under NFD; Đ does not and is mapped by hand.
    expect(normalizujZaPretragu("Đorđević")).toBe("dordevic");
    expect(normalizujZaPretragu("Šaban Šaulić")).toBe("saban saulic");
    expect(normalizujZaPretragu("ČAČAK")).toBe("cacak");
  });

  it("reduces a phone number to its national digits", () => {
    expect(normalizujCifre("+381641234567")).toBe("641234567");
    expect(normalizujCifre("064 123 4567")).toBe("641234567");
    expect(normalizujCifre("marko")).toBe("");
  });
});

describe("pretraga — name, phone and destination (SPEC §3)", () => {
  it("matches a name without typing the diacritics", () => {
    expect(imena(pretraziRezervacije(SVI, "saban"))).toEqual(["Šaban Šaulić"]);
    expect(imena(pretraziRezervacije(SVI, "dordevic"))).toEqual([
      "Dragan Đorđević",
    ]);
  });

  it("matches a phone typed the way it is dialled at home", () => {
    // Stored as +381641234567 so it dials from Greece; typed as 064 123 4567.
    expect(imena(pretraziRezervacije(SVI, "064 123 4567"))).toEqual([
      "Marko Petrović",
    ]);
    expect(prolaziPretragu(R1, pripremiUpit("1234567"))).toBe(true);
  });

  it("matches a destination at any of its three levels", () => {
    expect(imena(pretraziRezervacije(SVI, "hanioti"))).toEqual([
      "Aleksandar Cvetković",
      "Marko Petrović",
    ]);
    expect(pretraziRezervacije(SVI, "kasandra").length).toBe(3); // #1, #3, #8
    expect(pretraziRezervacije(SVI, "grcka").length).toBe(4); // #1, #2, #3, #8
  });

  it("searches BOTH destination columns", () => {
    // #4 has no return date; Zagreb is its outbound, Beograd its return.
    expect(prolaziPretragu(R4, pripremiUpit("zagreb"))).toBe(true);
    expect(prolaziPretragu(R4, pripremiUpit("beograd"))).toBe(true);
    // #6 goes to Kopaonik and comes back to Beograd.
    expect(prolaziPretragu(R6, pripremiUpit("kopaonik"))).toBe(true);
    expect(prolaziPretragu(R6, pripremiUpit("beograd"))).toBe(true);
  });

  it("ignores the date entirely — a booking with no main leg is still found", () => {
    expect(imena(pretraziRezervacije(SVI, "stefan"))).toEqual(["Stefan Nikolić"]);
  });

  it("narrows with every extra word", () => {
    expect(pretraziRezervacije(SVI, "saban").length).toBe(1);
    expect(pretraziRezervacije(SVI, "saban ljubljana").length).toBe(1);
    expect(pretraziRezervacije(SVI, "saban hanioti").length).toBe(0);
  });

  it("an empty or whitespace query matches everything", () => {
    expect(pretraziRezervacije(SVI, "")).toHaveLength(SVI.length);
    expect(pretraziRezervacije(SVI, "   ")).toHaveLength(SVI.length);
    expect(pretraziRezervacije(SVI, null)).toHaveLength(SVI.length);
    expect(pripremiUpit("  ")).toBeNull();
  });

  it("finds nothing for a query that matches nothing", () => {
    expect(pretraziRezervacije(SVI, "reykjavik")).toHaveLength(0);
  });

  it("keeps the digit tokens lined up with the word tokens", () => {
    // "saban" has no digits; that must not make it match every phone number.
    const upit = pripremiUpit("saban 999");
    expect(upit?.cifre).toEqual(["", "999"]);
    expect(prolaziPretragu(R7, upit!)).toBe(false);
  });
});
