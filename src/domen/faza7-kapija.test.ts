/**
 * Phase 7 — the verification gate.
 *
 * Only the rows of SPEC §1–§3 that had no direct assertion before. Nothing
 * here duplicates an existing test; each case is one line of the spec that the
 * 234-test suite did not name.
 */
import { describe, expect, it } from "vitest";
import {
  BEOGRAD,
  DANAS,
  HANIOTI,
  KATALOG,
  KOPAONIK,
  MARIJA,
  NIKOLA,
  SIVIRI,
  SOLUN,
  SVI,
  dan,
  imena,
  red,
} from "./fiksture";
import { kljucDrzave, kljucGrada, kljucRegije } from "./destinacije";
import { resolveMainLeg } from "./glavna-etapa";
import { danView, pretragaView, prikaziListu, rasporedView } from "./liste";
import { sortirajStavke } from "./sortiranje";
import type { StavkaListe } from "./tipovi";

const kljucevi = (s: readonly StavkaListe[]) => s.map((x) => x.kljuc);

describe("SPEC §1 — rows of the main-leg table with no direct assertion", () => {
  it("departure today AND return today is still Odlazak, not Povratak", () => {
    const r = red({
      n: 30,
      ime: "Isti Dan",
      telefon: "+381600000030",
      destinacija: KOPAONIK,
      datumPolaska: dan(0),
      datumPovratka: dan(0),
      brojPutnika: 2,
    });
    const glavna = resolveMainLeg(r, DANAS);
    expect(glavna?.smer).toBe("odlazak");
    expect(glavna?.datum).toBe(DANAS);
    expect(glavna?.destinacija.id).toBe(KOPAONIK.id);
  });

  it("departed AND returned already still resolves to the return leg", () => {
    const r = red({
      n: 31,
      ime: "Prošlost",
      telefon: "+381600000031",
      destinacija: SOLUN,
      datumPolaska: dan(-20),
      datumPovratka: dan(-10),
      brojPutnika: 2,
    });
    const glavna = resolveMainLeg(r, DANAS);
    expect(glavna?.smer).toBe("povratak");
    expect(glavna?.datum).toBe(dan(-10));
    expect(glavna?.destinacija.id).toBe(BEOGRAD.id);
  });

  it("a return falling exactly today is still on Raspored", () => {
    const r = red({
      n: 32,
      ime: "Vraća se danas",
      telefon: "+381600000032",
      destinacija: SOLUN,
      datumPolaska: dan(-6),
      datumPovratka: dan(0),
      brojPutnika: 2,
    });
    expect(imena(rasporedView([r], { danas: DANAS }))).toEqual([
      "Vraća se danas",
    ]);
  });

  it("a Greece to Beograd one-way behaves like any other trip", () => {
    // Odakle = Solun in the return column, Kuda = Beograd in the outbound one.
    const r = red({
      n: 33,
      ime: "Kući iz Grčke",
      telefon: "+381600000033",
      destinacija: BEOGRAD,
      destinacijaPovratka: SOLUN,
      datumPolaska: dan(4),
      datumPovratka: null,
      brojPutnika: 2,
    });
    const glavna = resolveMainLeg(r, DANAS);
    expect(glavna?.smer).toBe("odlazak");
    expect(glavna?.destinacija.id).toBe(BEOGRAD.id);
    expect(
      imena(
        rasporedView([r], {
          danas: DANAS,
          destinacije: [kljucGrada(BEOGRAD)],
          katalog: KATALOG,
        }),
      ),
    ).toEqual(["Kući iz Grčke"]);
  });
});

describe("SPEC §1 — the booking with no main leg, in all three modes", () => {
  // R4: Stefan Nikolić, departed dan(-3), no return date.
  it("Raspored drops it", () => {
    expect(imena(rasporedView(SVI, { danas: DANAS }))).not.toContain(
      "Stefan Nikolić",
    );
  });

  it("Dan reaches it by filtering its past departure date", () => {
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-3), do: dan(-3) },
    });
    expect(imena(stavke)).toContain("Stefan Nikolić");
    expect(
      stavke.find((s) => s.red.rezervacija.ime === "Stefan Nikolić")?.smer,
    ).toBe("odlazak");
  });

  it("Pretraga reaches it by name and shows its departure leg", () => {
    const stavke = pretragaView(SVI, { danas: DANAS, pretraga: "nikolic" });
    expect(imena(stavke)).toEqual(["Stefan Nikolić"]);
    expect(stavke[0]?.smer).toBe("odlazak");
    expect(stavke[0]?.datum).toBe(dan(-3));
  });

  it("prikaziListu routes all three the same way", () => {
    expect(prikaziListu(SVI, { danas: DANAS }).rezim).toBe("raspored");
    expect(
      prikaziListu(SVI, { danas: DANAS, opseg: { od: dan(-3), do: dan(-3) } })
        .rezim,
    ).toBe("dan");
    expect(prikaziListu(SVI, { danas: DANAS, pretraga: "nikolic" }).rezim).toBe(
      "pretraga",
    );
  });
});

describe("SPEC §2 — Dan applies neither the rule nor the horizon", () => {
  it("a same-day round trip emits two rows with distinct kljuc values", () => {
    // R6 Dragan Đorđević departs and returns on dan(2).
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(2), do: dan(2) },
    });
    const njegovi = stavke.filter(
      (s) => s.red.rezervacija.ime === "Dragan Đorđević",
    );
    expect(njegovi).toHaveLength(2);
    expect(njegovi.map((s) => s.smer)).toEqual(["odlazak", "povratak"]);
    expect(new Set(kljucevi(njegovi)).size).toBe(2);
    const id = njegovi[0]!.red.rezervacija.id;
    expect(kljucevi(njegovi)).toEqual([`${id}#odlazak`, `${id}#povratak`]);
  });

  it("shows a leg the main-leg rule would have hidden", () => {
    // R3 departed dan(-5); its main leg is the return. Dan on dan(-5) must
    // still show the departure leg, to Siviri.
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-5), do: dan(-5) },
    });
    const s = stavke.find((x) => x.red.rezervacija.ime === "Porodica Jovanović");
    expect(s?.smer).toBe("odlazak");
    expect(s?.destinacija.id).toBe(SIVIRI.id);
    expect(resolveMainLeg(s!.red, DANAS)?.smer).toBe("povratak");
  });

  it("Raspored emits at most one row per reservation, Dan may emit two", () => {
    const raspored = rasporedView(SVI, { danas: DANAS });
    expect(new Set(raspored.map((s) => s.red.rezervacija.id)).size).toBe(
      raspored.length,
    );
    const danStavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-10), do: dan(30) },
    });
    expect(danStavke.length).toBeGreaterThan(
      new Set(danStavke.map((s) => s.red.rezervacija.id)).size,
    );
  });
});

describe("SPEC §5 — the Beograd test and the rollup", () => {
  it("Beograd matches a one-way home and an ordinary return at once", () => {
    // R5 Ana Marković: Beograd in the OUTBOUND column, departs dan(3).
    // R3 Porodica Jovanović: departed, so its main leg is the return, home.
    const stavke = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucGrada(BEOGRAD)],
      katalog: KATALOG,
    });
    expect(imena(stavke).sort()).toEqual(
      ["Ana Marković", "Porodica Jovanović"].sort(),
    );
  });

  it("a country whose every region holds one city still rolls up", () => {
    // Srbija: Beograd and Kopaonik, one city each.
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-30), do: dan(30) },
      destinacije: [kljucDrzave(BEOGRAD)],
      katalog: KATALOG,
    });
    const gradovi = new Set(stavke.map((s) => s.destinacija.grad));
    expect([...gradovi].sort()).toEqual(["Beograd", "Kopaonik"]);
  });

  it("a region key matches only its own cities, never the whole country", () => {
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-30), do: dan(30) },
      destinacije: [kljucRegije(HANIOTI)], // Kasandra
      katalog: KATALOG,
    });
    const gradovi = new Set(stavke.map((s) => s.destinacija.grad));
    expect([...gradovi].sort()).toEqual(["Hanioti", "Siviri"]);
  });

  it("date AND destination; several destinations OR", () => {
    const opseg = { od: dan(-30), do: dan(30) };
    const samoKopaonik = danView(SVI, {
      danas: DANAS,
      opseg,
      destinacije: [kljucGrada(KOPAONIK)],
      katalog: KATALOG,
    });
    const oba = danView(SVI, {
      danas: DANAS,
      opseg,
      destinacije: [kljucGrada(KOPAONIK), kljucGrada(HANIOTI)],
      katalog: KATALOG,
    });
    expect(oba.length).toBeGreaterThan(samoKopaonik.length);
    const uzak = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(2), do: dan(2) },
      destinacije: [kljucGrada(KOPAONIK), kljucGrada(HANIOTI)],
      katalog: KATALOG,
    });
    expect(uzak.length).toBeLessThan(oba.length);
  });
});

describe("SPEC §2 — the four sort keys, and stability", () => {
  /** Four rows identical on date, direction, destination and name. */
  const blizanci = [1, 2, 3, 4].map((i) =>
    red({
      n: 40 + i,
      ime: "Ista Osoba",
      telefon: `+38160000004${i}`,
      destinacija: HANIOTI,
      datumPolaska: dan(5),
      datumPovratka: dan(9),
      brojPutnika: 2,
      autor: i % 2 ? NIKOLA : MARIJA,
    }),
  );

  it("reservation id is the final tiebreak, and it is really used", () => {
    const unazad = [...blizanci].reverse();
    const a = rasporedView(blizanci, { danas: DANAS });
    const b = rasporedView(unazad, { danas: DANAS });
    const ids = a.map((s) => s.red.rezervacija.id);
    expect(ids).toEqual([...ids].sort());
    expect(b.map((s) => s.red.rezervacija.id)).toEqual(ids);
  });

  it("is stable across repeated renders and every input order", () => {
    const prvi = rasporedView(SVI, { danas: DANAS });
    for (let i = 0; i < 5; i++) {
      expect(kljucevi(rasporedView(SVI, { danas: DANAS }))).toEqual(
        kljucevi(prvi),
      );
    }
    const permutacije = [
      [...SVI],
      [...SVI].reverse(),
      [...SVI].slice(3).concat([...SVI].slice(0, 3)),
    ];
    for (const p of permutacije) {
      expect(kljucevi(rasporedView(p, { danas: DANAS }))).toEqual(
        kljucevi(prvi),
      );
    }
  });

  it("descending by date reverses the days, not the order inside one", () => {
    const opseg = { od: dan(-30), do: dan(30) };
    const rastuce = danView(SVI, { danas: DANAS, opseg });
    const opadajuce = danView(SVI, {
      danas: DANAS,
      opseg,
      sort: { polje: "datum", smer: "opadajuce" },
    });
    const daniR = [...new Set(rastuce.map((s) => s.datum))];
    const daniO = [...new Set(opadajuce.map((s) => s.datum))];
    expect(daniO).toEqual([...daniR].reverse());
    for (const d of daniR) {
      const a = rastuce.filter((s) => s.datum === d).map((s) => s.kljuc);
      const b = opadajuce.filter((s) => s.datum === d).map((s) => s.kljuc);
      expect(b).toEqual(a);
    }
  });

  it("descending by destination reverses only the destination key", () => {
    const opseg = { od: dan(-30), do: dan(30) };
    const rastuce = danView(SVI, {
      danas: DANAS,
      opseg,
      sort: { polje: "destinacija", smer: "rastuce" },
    });
    const opadajuce = danView(SVI, {
      danas: DANAS,
      opseg,
      sort: { polje: "destinacija", smer: "opadajuce" },
    });
    const grupe = (l: StavkaListe[]) => [
      ...new Set(l.map((s) => s.destinacija.grad)),
    ];
    expect(grupe(opadajuce)).toEqual([...grupe(rastuce)].reverse());
    for (const g of grupe(rastuce)) {
      const a = rastuce.filter((s) => s.destinacija.grad === g);
      const b = opadajuce.filter((s) => s.destinacija.grad === g);
      expect(b.map((s) => s.kljuc)).toEqual(a.map((s) => s.kljuc));
      expect(a.map((s) => s.datum)).toEqual([...a.map((s) => s.datum)].sort());
    }
  });

  it("sortirajStavke is idempotent", () => {
    const jednom = sortirajStavke(
      danView(SVI, { danas: DANAS, opseg: { od: dan(-30), do: dan(30) } }),
    );
    expect(kljucevi(sortirajStavke(jednom))).toEqual(kljucevi(jednom));
  });
});
