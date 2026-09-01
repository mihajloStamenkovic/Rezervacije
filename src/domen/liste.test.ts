import { describe, expect, it } from "vitest";
import {
  BEOGRAD,
  DANAS,
  HANIOTI,
  KATALOG,
  LJUBLJANA,
  SIVIRI,
  SVI,
  dan,
  imena,
} from "./fiksture";
import {
  danView,
  grupisiPoDanu,
  grupisiPoSmeru,
  prikaziListu,
  pretragaView,
  rasporedView,
} from "./liste";
import { opsegZaCip, opsegZaDan } from "./filteri";
import { kljucDrzave, kljucGrada, kljucRegije } from "./destinacije";

describe("rasporedView — one row per reservation, SPEC §2", () => {
  const stavke = rasporedView(SVI, { danas: DANAS });

  it("emits exactly one row per reservation that has a main leg", () => {
    // Eight seed rows, one of which (#4) has no main date.
    expect(stavke).toHaveLength(7);
    expect(new Set(stavke.map((s) => s.red.rezervacija.id)).size).toBe(7);
  });

  it("is sorted by main date ascending, with the same-day tiebreak", () => {
    expect(imena(stavke)).toEqual([
      "Jelena Ilić", // dan(0)  — departing today
      "Aleksandar Cvetković", // dan(2) Hanioti
      "Dragan Đorđević", // dan(2) Kopaonik — destination A–Z
      "Ana Marković", // dan(3)
      "Porodica Jovanović", // dan(9)  — a return
      "Šaban Šaulić", // dan(10)
      "Marko Petrović", // dan(14)
    ]);
    const datumi = stavke.map((s) => s.datum);
    expect([...datumi].sort()).toEqual(datumi);
  });

  it("shows each row's own main leg, departure or return", () => {
    const poImenu = new Map(stavke.map((s) => [s.red.rezervacija.ime, s]));
    expect(poImenu.get("Jelena Ilić")).toMatchObject({
      smer: "odlazak",
      datum: DANAS,
    });
    expect(poImenu.get("Porodica Jovanović")).toMatchObject({
      smer: "povratak",
      destinacija: BEOGRAD,
    });
  });

  it("drops the booking that departed with no return date", () => {
    expect(imena(stavke)).not.toContain("Stefan Nikolić");
  });

  it("drops a booking whose main date has already passed", () => {
    // Ten days on, #6 has departed and returned; it has a main leg but it is
    // behind us, so it is not part of "what is coming up".
    const kasnije = rasporedView(SVI, { danas: dan(10) });
    expect(imena(kasnije)).not.toContain("Dragan Đorđević");
    expect(imena(kasnije)).toContain("Marko Petrović");
  });

  it("keeps a booking that departs today (the >= boundary)", () => {
    expect(imena(stavke)[0]).toBe("Jelena Ilić");
    expect(stavke[0].smer).toBe("odlazak");
  });

  it("renders a booking pointing at an inactive destination", () => {
    const saban = stavke.find((s) => s.red.rezervacija.ime === "Šaban Šaulić")!;
    expect(saban.destinacija.grad).toBe("Ljubljana");
    expect(saban.destinacija.aktivna).toBe(false);
  });
});

describe("danView — one row per leg, SPEC §2", () => {
  it("a same-day round trip appears in both groups of that day", () => {
    const stavke = danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(2)) });
    const dragan = stavke.filter((s) => s.red.rezervacija.ime === "Dragan Đorđević");
    expect(dragan).toHaveLength(2);
    expect(dragan.map((s) => s.smer)).toEqual(["odlazak", "povratak"]);
    expect(dragan[0].destinacija.grad).toBe("Kopaonik");
    expect(dragan[1].destinacija.grad).toBe("Beograd");
    // Two rows for one reservation, so the key cannot be the id alone.
    expect(new Set(dragan.map((s) => s.kljuc)).size).toBe(2);
  });

  it("departures come before returns", () => {
    const stavke = danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(2)) });
    const { polasci, povratci } = grupisiPoSmeru(stavke);
    expect(imena(polasci)).toEqual(["Aleksandar Cvetković", "Dragan Đorđević"]);
    expect(imena(povratci)).toEqual(["Dragan Đorđević"]);
    expect(stavke.map((s) => s.smer)).toEqual([
      "odlazak",
      "odlazak",
      "povratak",
    ]);
  });

  it("a reservation can contribute two rows on two different days", () => {
    const mesec = danView(SVI, {
      danas: DANAS,
      opseg: opsegZaCip("ovajMesec", DANAS),
    });
    const jelena = mesec.filter((s) => s.red.rezervacija.ime === "Jelena Ilić");
    expect(jelena.map((s) => [s.smer, s.datum])).toEqual([
      ["odlazak", dan(0)],
      ["povratak", dan(7)],
    ]);
  });

  it("counts legs, not bookings", () => {
    const mesec = danView(SVI, {
      danas: DANAS,
      opseg: opsegZaCip("ovajMesec", DANAS),
    });
    // 01.01–31.01.2026: all eight departures — including the two already in
    // the past — plus five of the six returns. #1 returns on 12.02, and #4
    // and #5 have no return date at all.
    expect(mesec).toHaveLength(13);
    expect(mesec.filter((s) => s.smer === "odlazak")).toHaveLength(8);
    expect(mesec.filter((s) => s.smer === "povratak")).toHaveLength(5);
  });

  it("reaches the booking with no main date by filtering its past departure", () => {
    // SPEC §1: reachable "by search on the name, or by filtering its past
    // departure date". Not by any list of what is coming up.
    const proslost = danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(-3)) });
    expect(imena(proslost)).toEqual(["Stefan Nikolić"]);
    expect(proslost[0]).toMatchObject({ smer: "odlazak", datum: dan(-3) });

    const nedelja = danView(SVI, {
      danas: DANAS,
      opseg: opsegZaCip("ovaNedelja", DANAS),
    });
    expect(imena(nedelja)).toContain("Stefan Nikolić");
  });

  it("an empty day is an empty list, not an error", () => {
    expect(danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(-1)) })).toEqual([]);
  });

  it("groups into days in order", () => {
    const nedelja = danView(SVI, {
      danas: DANAS,
      opseg: opsegZaCip("ovaNedelja", DANAS),
    });
    const grupe = grupisiPoDanu(nedelja);
    expect(grupe.map((g) => g.datum)).toEqual([
      dan(-3), // 12.01 — Stefan Nikolić's past departure
      dan(0), // 15.01 — Jelena Ilić departs
      dan(2), // 17.01 — the round trip and Aleksandar
      dan(3), // 18.01 — Ana Marković
    ]);
    expect(grupe.map((g) => g.stavke.length)).toEqual([1, 1, 3, 1]);
  });
});

describe("destination filter — matches a LEG, not a booking (SPEC §5)", () => {
  it("a country matches a city inside it (Grčka → Hanioti)", () => {
    const stavke = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucDrzave(HANIOTI)],
      katalog: KATALOG,
    });
    expect(imena(stavke)).toEqual([
      "Jelena Ilić", // Solun
      "Aleksandar Cvetković", // Hanioti
      "Marko Petrović", // Hanioti
    ]);
  });

  it("a departed trip leaves the Grčka filter, because its leg is now home", () => {
    // #3 went to Siviri, in Grčka, and has departed. Its main destination is
    // Beograd now, so filtering Grčka must not return it.
    const grcka = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucDrzave(SIVIRI)],
      katalog: KATALOG,
    });
    expect(imena(grcka)).not.toContain("Porodica Jovanović");

    // The same booking, before it departed: it was in the filter then.
    const ranije = rasporedView(SVI, {
      danas: dan(-6),
      destinacije: [kljucDrzave(SIVIRI)],
      katalog: KATALOG,
    });
    expect(imena(ranije)).toContain("Porodica Jovanović");
  });

  it("a region matches only its own cities", () => {
    // Kasandra covers Hanioti and Siviri; Sitonija's Sarti and Solun are out.
    const stavke = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucRegije(HANIOTI)],
      katalog: KATALOG,
    });
    expect(imena(stavke)).toEqual(["Aleksandar Cvetković", "Marko Petrović"]);
    expect(imena(stavke)).not.toContain("Jelena Ilić"); // Solun i okolina
  });

  it("a place matches from BOTH destination columns", () => {
    // #5 is a one-way ride home: Beograd sits in the *outbound* column.
    // #3 is an ordinary return to Beograd. One checkbox, both bookings.
    const stavke = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucGrada(BEOGRAD)],
      katalog: KATALOG,
    });
    expect(imena(stavke)).toEqual(["Ana Marković", "Porodica Jovanović"]);
    expect(stavke.map((s) => s.smer)).toEqual(["odlazak", "povratak"]);
  });

  it("several destinations OR together", () => {
    const stavke = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucGrada(BEOGRAD), kljucDrzave(LJUBLJANA)],
      katalog: KATALOG,
    });
    expect(imena(stavke)).toEqual([
      "Ana Marković",
      "Porodica Jovanović",
      "Šaban Šaulić",
    ]);
  });

  it("date AND destination compose", () => {
    const stavke = danView(SVI, {
      danas: DANAS,
      opseg: opsegZaCip("ovajMesec", DANAS),
      destinacije: [kljucGrada(BEOGRAD)],
      katalog: KATALOG,
    });
    // Every Beograd leg inside January: the one-way home (#5) plus the returns
    // of #2, #3, #6, #7 and #8. #1 returns in February.
    expect(stavke.map((s) => `${s.datum} ${s.smer}`)).toEqual([
      `${dan(2)} povratak`, // #6
      `${dan(3)} odlazak`, // #5 — Beograd in the outbound column
      `${dan(7)} povratak`, // #2
      `${dan(9)} povratak`, // #3
      `${dan(12)} povratak`, // #7
      `${dan(16)} povratak`, // #8
    ]);
  });

  it("resolves the rollup identically with or without the reference table", () => {
    // The catalogue is optional: a leg can only point at a destination the
    // rows already carry, so the matches are the same either way.
    const sa = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucDrzave(HANIOTI)],
      katalog: KATALOG,
    });
    const bez = rasporedView(SVI, {
      danas: DANAS,
      destinacije: [kljucDrzave(HANIOTI)],
    });
    expect(bez.map((s) => s.kljuc)).toEqual(sa.map((s) => s.kljuc));
  });

  it("an empty selection is no filter at all", () => {
    expect(
      rasporedView(SVI, { danas: DANAS, destinacije: [], katalog: KATALOG }),
    ).toHaveLength(7);
  });
});

describe("pretragaView — the only way to reach a booking with no main date", () => {
  it("finds it, and shows its departure leg", () => {
    const stavke = pretragaView(SVI, { danas: DANAS, pretraga: "stefan" });
    expect(imena(stavke)).toEqual(["Stefan Nikolić"]);
    expect(stavke[0]).toMatchObject({ smer: "odlazak", datum: dan(-3) });
    expect(stavke[0].destinacija.grad).toBe("Zagreb");
  });

  it("Raspored cannot reach it, whatever is typed", () => {
    expect(rasporedView(SVI, { danas: DANAS, pretraga: "stefan" })).toEqual([]);
  });

  it("shows the main leg for everything that has one", () => {
    const stavke = pretragaView(SVI, { danas: DANAS, pretraga: "beograd" });
    const porodica = stavke.find(
      (s) => s.red.rezervacija.ime === "Porodica Jovanović",
    )!;
    expect(porodica).toMatchObject({ smer: "povratak", datum: dan(9) });
  });

  it("emits one row per reservation, never two", () => {
    const stavke = pretragaView(SVI, { danas: DANAS, pretraga: "beograd" });
    expect(new Set(stavke.map((s) => s.red.rezervacija.id)).size).toBe(
      stavke.length,
    );
  });
});

describe("prikaziListu — the entry point the screen calls", () => {
  it("picks Raspored by default", () => {
    const { rezim, stavke } = prikaziListu(SVI, { danas: DANAS });
    expect(rezim).toBe("raspored");
    expect(stavke).toHaveLength(7);
  });

  it("switches to Dan the moment a date filter is on", () => {
    const { rezim, stavke } = prikaziListu(SVI, {
      danas: DANAS,
      opseg: opsegZaDan(dan(2)),
    });
    expect(rezim).toBe("dan");
    expect(stavke).toHaveLength(3);
  });

  it("switches to Pretraga when only a search is on", () => {
    const { rezim, stavke } = prikaziListu(SVI, {
      danas: DANAS,
      pretraga: "stefan",
    });
    expect(rezim).toBe("pretraga");
    expect(imena(stavke)).toEqual(["Stefan Nikolić"]);
  });

  it("refuses to run without a valid Belgrade today", () => {
    // `danas` is injected, never read from the device clock (SPEC §7). The
    // guard is what stops a stray `new Date().toISOString()` sneaking in.
    expect(() => prikaziListu(SVI, { danas: "2026-1-15" })).toThrow(
      /Neispravan datum/,
    );
  });
});
