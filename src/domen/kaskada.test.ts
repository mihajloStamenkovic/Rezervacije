/**
 * The form's dropdown lists.
 *
 * The case that matters most is the last one: an inactive destination is
 * hidden from a new booking but must survive editing an old one.
 */
import { describe, expect, it } from "vitest";
import {
  drzavaTraziRegiju,
  drzaveZaFormu,
  gradoviDrzaveZaFormu,
  gradoviZaFormu,
  katalogZaFormu,
  kljucNaziva,
  nadjiGradUDrzavi,
  nadjiMesto,
  regijeZaFormu,
  sledeciRedosled,
  uskladiRegiju,
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

/*
 * SPEC §5, amended 06.09.2026: a place that is not in the list may be typed.
 * Everything below is the defence against that filling the destination filter
 * with near-duplicates of towns that are already there.
 */
describe("kljucNaziva", () => {
  it("folds case, diacritics and repeated spaces", () => {
    expect(kljucNaziva("  Novi   MARMARAS ")).toBe("novi marmaras");
    expect(kljucNaziva("Šišići")).toBe(kljucNaziva("sisici"));
    // Đ has no canonical decomposition — NFD alone would leave it standing.
    expect(kljucNaziva("Đevđelija")).toBe("devdelija");
  });
});

describe("nadjiMesto", () => {
  it("finds a town already in the list, however it was typed", () => {
    expect(
      nadjiMesto(KATALOG, {
        drzavaSifra: "grcka",
        regija: "kasandra",
        grad: " hanioti ",
      }),
    ).toBe(HANIOTI);
  });

  it("does not match a town of the same name in another region", () => {
    expect(
      nadjiMesto(KATALOG, {
        drzavaSifra: "grcka",
        regija: "Sitonija",
        grad: "Hanioti",
      }),
    ).toBeNull();
  });

  it("matches an inactive row, because typing the name asks for it", () => {
    expect(
      nadjiMesto(KATALOG, {
        drzavaSifra: LJUBLJANA.drzavaSifra,
        regija: LJUBLJANA.regija,
        grad: "ljubljana",
      }),
    ).toBe(LJUBLJANA);
  });

  it("returns null for a town that is genuinely new", () => {
    expect(
      nadjiMesto(KATALOG, {
        drzavaSifra: "grcka",
        regija: "Kasandra",
        grad: "Nea Fokea",
      }),
    ).toBeNull();
  });
});

describe("uskladiRegiju", () => {
  it("reuses the spelling the country already has", () => {
    expect(uskladiRegiju(KATALOG, "grcka", "kasandra")).toBe("Kasandra");
  });

  it("keeps a genuinely new region as typed, trimmed", () => {
    expect(uskladiRegiju(KATALOG, "grcka", "  Sitonija ")).toBe("Sitonija");
  });

  it("does not borrow a region name from another country", () => {
    expect(uskladiRegiju(KATALOG, "srbija", "kasandra")).toBe("kasandra");
  });
});

describe("sledeciRedosled", () => {
  it("puts a typed place last within its country", () => {
    const najveci = Math.max(
      ...KATALOG.filter((d) => d.drzavaSifra === "grcka").map(
        (d) => d.redosled,
      ),
    );
    expect(sledeciRedosled(KATALOG, "grcka")).toBe(najveci + 1);
  });

  it("starts at zero for a country with nothing in it yet", () => {
    expect(sledeciRedosled(KATALOG, "austrija")).toBe(0);
  });
});

/**
 * Which countries show a region at all — SPEC §5, amended 09.09.2026.
 *
 * The owner asked for Serbia to lose its region. This is the rule that gives
 * him that without naming him a country: a region is worth a tap only where it
 * narrows the town list.
 */
describe("drzavaTraziRegiju", () => {
  it("says no where every region holds one town", () => {
    // `Srbija › Beograd › Beograd`, `Srbija › Kopaonik › Kopaonik` — the region
    // is the town's name asked a second time. This is the owner's case.
    expect(drzavaTraziRegiju(KATALOG, "srbija")).toBe(false);
  });

  it("says no where the country has a single region", () => {
    // One region over however many towns narrows nothing: every town is in it.
    expect(drzavaTraziRegiju(KATALOG, "slovenija")).toBe(false);
    expect(drzavaTraziRegiju(KATALOG, "hrvatska")).toBe(false);
  });

  it("says yes where a region really groups towns", () => {
    // Kasandra holds Hanioti and Siviri, and forty minutes of driving sits
    // between them. This is the case the middle dropdown exists for.
    expect(drzavaTraziRegiju(KATALOG, "grcka")).toBe(true);
  });

  it("needs both halves of the rule at once", () => {
    const jednaRegijaDveVarosi = [SOLUN, { ...SARTI, regija: SOLUN.regija }];
    expect(drzavaTraziRegiju(jednaRegijaDveVarosi, "grcka")).toBe(false);

    const dveRegijePoJedna = [SOLUN, SARTI];
    expect(drzavaTraziRegiju(dveRegijePoJedna, "grcka")).toBe(false);

    expect(drzavaTraziRegiju([SOLUN, HANIOTI, SIVIRI], "grcka")).toBe(true);
  });

  it("answers for the catalogue it is given, not for the whole table", () => {
    // The form is handed the active rows plus whatever the booking being
    // edited points at, and the dropdowns have to match what is on offer.
    expect(drzavaTraziRegiju([], "srbija")).toBe(false);
    expect(drzavaTraziRegiju(KATALOG, "")).toBe(false);
    expect(drzavaTraziRegiju(KATALOG, "austrija")).toBe(false);
  });
});

/*
 * Povratak drops the region level entirely (owner's request, 06.09.2026), so
 * both of these answer questions that leg cannot ask.
 */
describe("gradoviDrzaveZaFormu", () => {
  it("lists every town of a country in the client's order, regions ignored", () => {
    const srbija = gradoviDrzaveZaFormu(KATALOG, "srbija").map((g) => g.naziv);
    expect(srbija[0]).toBe("Beograd");
    expect(srbija).toContain("Kopaonik");
  });

  it("flattens towns that sit in different regions of one country", () => {
    const grcka = gradoviDrzaveZaFormu(KATALOG, "grcka").map((g) => g.naziv);
    expect(grcka).toContain(HANIOTI.grad);
    expect(grcka).toContain(SOLUN.grad);
    expect(new Set(grcka).size).toBe(grcka.length);
  });

  it("is empty for a country that is not in the catalogue", () => {
    expect(gradoviDrzaveZaFormu(KATALOG, "austrija")).toEqual([]);
  });
});

describe("nadjiGradUDrzavi", () => {
  it("finds a town without being told its region", () => {
    // The Povratak leg never asks for one, and matching Hanioti as if its
    // region were "Hanioti" would miss Kasandra and add a second row.
    expect(nadjiGradUDrzavi(KATALOG, "grcka", " hanioti ")).toBe(HANIOTI);
  });

  it("does not cross a border to find a name", () => {
    expect(nadjiGradUDrzavi(KATALOG, "srbija", "Hanioti")).toBeNull();
  });

  it("returns null when the town really is new", () => {
    expect(nadjiGradUDrzavi(KATALOG, "grcka", "Nea Fokea")).toBeNull();
  });
});
