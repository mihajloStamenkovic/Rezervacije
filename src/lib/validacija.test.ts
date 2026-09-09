/**
 * The reservation form schema.
 *
 * These are the cases where a wrong answer reaches the database: a phone that
 * will not dial from abroad, an empty return date stored as `""`, or a return
 * before its departure.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_ADRESE,
  MAX_CENE,
  MAX_NAPOMENE,
  MAX_NAZIVA,
  MAX_PUTNIKA,
  RezervacijaSchema,
  greskePolja,
  izFormData,
  pomeriPutnike,
  type UlazRezervacije,
} from "./validacija";
import { T } from "./tekst";

const BEOGRAD = "00000000-0000-4000-8000-200000000001";
const HANIOTI = "00000000-0000-4000-8000-200000000005";

/** A destination picked from the dropdowns: an id, nothing typed. */
const izabrana = (id: string) => ({
  id,
  drzavaSifra: "",
  regija: "",
  grad: "",
});

/** A destination typed by hand: no id, a country picked, a name written. */
const upisana = (regija: string, grad: string) => ({
  id: "",
  drzavaSifra: "grcka",
  regija,
  grad,
});

const ispravan: UlazRezervacije = {
  ime: "Marko Petrović",
  telefon: "064 123 4567",
  adresa: "Bulevar kralja Aleksandra 73",
  destinacija: izabrana(HANIOTI),
  datumPolaska: "2026-01-01",
  destinacijaPovratka: izabrana(BEOGRAD),
  datumPovratka: "2026-01-15",
  brojPutnika: "4",
  cena: "480",
  napomena: "",
};

const parsiraj = (izmene: Partial<UlazRezervacije> = {}) =>
  RezervacijaSchema.safeParse({ ...ispravan, ...izmene });

const greskaZa = (izmene: Partial<UlazRezervacije>) => {
  const r = parsiraj(izmene);
  expect(r.success).toBe(false);
  return greskePolja(r.error!);
};

describe("RezervacijaSchema", () => {
  it("accepts the SPEC §1 worked example", () => {
    const r = parsiraj();
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      ime: "Marko Petrović",
      datumPolaska: "2026-01-01",
      datumPovratka: "2026-01-15",
      brojPutnika: 4,
    });
  });

  it("normalises the phone to E.164 so it dials from abroad", () => {
    expect(parsiraj().data?.telefon).toBe("+381641234567");
    expect(parsiraj({ telefon: "+381 64 123 4567" }).data?.telefon).toBe(
      "+381641234567",
    );
  });

  it("rejects a phone number that is not a real number", () => {
    expect(greskaZa({ telefon: "123" }).telefon).toBe(
      T.greske.telefonNeispravan,
    );
  });

  it("turns a blank return date into null, never an empty string", () => {
    const r = parsiraj({ datumPovratka: "" });
    expect(r.success).toBe(true);
    expect(r.data?.datumPovratka).toBeNull();
  });

  it("rejects a return before its departure", () => {
    expect(greskaZa({ datumPovratka: "2025-12-31" }).datumPovratka).toBe(
      T.greske.povratakPrePolaska,
    );
  });

  it("accepts a same-day round trip — the boundary is >=, not >", () => {
    expect(parsiraj({ datumPovratka: "2026-01-01" }).success).toBe(true);
  });

  it("trims the name and rejects one that is only whitespace", () => {
    expect(parsiraj({ ime: "  Ana  " }).data?.ime).toBe("Ana");
    expect(greskaZa({ ime: "   " }).ime).toBe(T.greske.imeObavezno);
  });

  it("distinguishes a missing passenger count from an invalid one", () => {
    expect(greskaZa({ brojPutnika: "" }).brojPutnika).toBe(
      T.greske.brojPutnikaObavezan,
    );
    expect(greskaZa({ brojPutnika: "0" }).brojPutnika).toBe(
      T.greske.brojPutnikaNeispravan,
    );
    expect(greskaZa({ brojPutnika: "2.5" }).brojPutnika).toBe(
      T.greske.brojPutnikaNeispravan,
    );
    expect(greskaZa({ brojPutnika: "nekoliko" }).brojPutnika).toBe(
      T.greske.brojPutnikaNeispravan,
    );
  });

  /**
   * `Number()` accepts more than anyone types into a passenger box. Each of
   * these produced a real integer and passed validation before Phase 7:
   * `1e3` became 1000, `0x10` became 16, and `2147483648` reached Postgres and
   * died on int4 overflow as the generic "Čuvanje nije uspelo."
   */
  it("rejects exponent and hex notation rather than silently converting it", () => {
    for (const zapis of ["1e3", "0x10", "1e21", "+5", " 5 ".trim() + "e1"]) {
      expect(greskaZa({ brojPutnika: zapis }).brojPutnika).toBe(
        T.greske.brojPutnikaNeispravan,
      );
    }
  });

  it("rejects a negative count with the same message as zero", () => {
    expect(greskaZa({ brojPutnika: "-1" }).brojPutnika).toBe(
      T.greske.brojPutnikaNeispravan,
    );
  });

  it("caps the passenger count and says so in its own words", () => {
    expect(parsiraj({ brojPutnika: String(MAX_PUTNIKA) }).data?.brojPutnika).toBe(
      MAX_PUTNIKA,
    );
    expect(greskaZa({ brojPutnika: String(MAX_PUTNIKA + 1) }).brojPutnika).toBe(
      T.greske.brojPutnikaPrevelik,
    );
    // The value that used to reach Postgres and overflow int4.
    expect(greskaZa({ brojPutnika: "2147483648" }).brojPutnika).toBe(
      T.greske.brojPutnikaPrevelik,
    );
  });

  it("still accepts the largest real booking in the data", () => {
    // Dragan Đorđević's minibus — 21 putnik, from the seed rows.
    expect(parsiraj({ brojPutnika: "21" }).data?.brojPutnika).toBe(21);
  });

  it("distinguishes a missing departure date from a malformed one", () => {
    expect(greskaZa({ datumPolaska: "" }).datumPolaska).toBe(
      T.greske.datumPolaskaObavezan,
    );
    expect(greskaZa({ datumPolaska: "01.01.2026." }).datumPolaska).toBe(
      T.greske.datumNeispravan,
    );
  });

  it("rejects anything that is neither a destination id nor a typed place", () => {
    expect(greskaZa({ destinacija: izabrana("") }).destinacija).toBe(
      T.greske.destinacijaObavezna,
    );
    expect(
      greskaZa({ destinacijaPovratka: izabrana("Grčka") }).destinacijaPovratka,
    ).toBe(T.greske.destinacijaObavezna);
  });

  /*
   * SPEC §5, amended 06.09.2026: a place that is not in the list may be typed.
   * The schema only says the input is well formed — it never creates a row,
   * because it has no database. That is `razresiDestinaciju`'s job.
   */
  it("accepts a place typed by hand instead of an id", () => {
    const r = parsiraj({ destinacija: upisana("Sitonija", "Novi Marmaras") });
    expect(r.success).toBe(true);
    expect(r.data?.destinacija).toEqual({
      id: null,
      novo: {
        drzavaSifra: "grcka",
        regija: "Sitonija",
        grad: "Novi Marmaras",
      },
    });
  });

  it("keeps the picked id and no typed place when one was chosen", () => {
    expect(parsiraj().data?.destinacija).toEqual({ id: HANIOTI, novo: null });
  });

  it("insists on the town, which is the part that cannot be inferred", () => {
    expect(greskaZa({ destinacija: upisana("Sitonija", "") }).destinacija).toBe(
      T.greske.nazivMestaObavezan,
    );
  });

  /*
   * The region is optional — Povratak has no region field at all, and
   * Odlazak's may be left blank. A town with no region becomes its own, which
   * is the shape `Srbija › Beograd › Beograd` already has. Filling that in is
   * the Server Action's job, so the schema only has to let it through.
   */
  it("accepts a typed town with no region", () => {
    const r = parsiraj({ destinacija: upisana("", "Nikiti") });
    expect(r.success).toBe(true);
    expect(r.data?.destinacija).toEqual({
      id: null,
      novo: { drzavaSifra: "grcka", regija: "", grad: "Nikiti" },
    });
  });

  it("refuses a name too long to be one", () => {
    expect(
      greskaZa({ destinacija: upisana("Sitonija", "a".repeat(MAX_NAZIVA + 1)) })
        .destinacija,
    ).toBe(T.greske.nazivPredugacak);
  });

  it("reports every bad field at once, not just the first", () => {
    const greske = greskaZa({ ime: "", telefon: "", brojPutnika: "" });
    expect(Object.keys(greske).sort()).toEqual([
      "brojPutnika",
      "ime",
      "telefon",
    ]);
  });
});

describe("izFormData", () => {
  it("reads a submitted form, with a missing field as an empty string", () => {
    const fd = new FormData();
    fd.set("ime", "Ana");
    fd.set("telefon", "0641234567");
    fd.set("destinacija", HANIOTI);
    fd.set("datumPolaska", "2026-01-01");
    fd.set("destinacijaPovratka", BEOGRAD);
    fd.set("brojPutnika", "2");
    fd.set("adresa", "Njegoševa 12");
    fd.set("cena", "300");
    // datumPovratka deliberately absent — the return is not agreed yet, and
    // napomena deliberately absent — it is optional.

    const ulaz = izFormData(fd);
    expect(ulaz.datumPovratka).toBe("");
    expect(ulaz.napomena).toBe("");
    // The cascade's other three inputs are absent here, and must read as empty
    // rather than as a half-typed place.
    expect(ulaz.destinacija).toEqual({
      id: HANIOTI,
      drzavaSifra: "",
      regija: "",
      grad: "",
    });

    const r = RezervacijaSchema.safeParse(ulaz);
    expect(r.success).toBe(true);
    expect(r.data?.datumPovratka).toBeNull();
    expect(r.data?.telefon).toBe("+381641234567");
    // An absent note is `null`, the same shape as an absent return date.
    expect(r.data?.napomena).toBeNull();
  });
});

/**
 * Address, price and note — SPEC §4, amended 07.09.2026.
 *
 * The address and the price are required *by the form* while their columns
 * stay nullable, because every booking entered before that date has neither
 * and none can be invented. These cases are what enforces the owner's choice
 * of "obavezne za nove"; the nullable column is what keeps the old bookings
 * readable.
 */
describe("adresa, cena i napomena", () => {
  it("requires a pickup address", () => {
    expect(greskaZa({ adresa: "" }).adresa).toBe(T.greske.adresaObavezna);
    expect(greskaZa({ adresa: "   " }).adresa).toBe(T.greske.adresaObavezna);
  });

  it("trims the address rather than storing the spaces around it", () => {
    expect(parsiraj({ adresa: "  Njegoševa 12  " }).data?.adresa).toBe(
      "Njegoševa 12",
    );
  });

  it("refuses an address longer than the guardrail", () => {
    expect(greskaZa({ adresa: "a".repeat(MAX_ADRESE + 1) }).adresa).toBe(
      T.greske.adresaPredugacka,
    );
  });

  it("requires a price and keeps it a whole number of euros", () => {
    expect(greskaZa({ cena: "" }).cena).toBe(T.greske.cenaObavezna);
    expect(parsiraj({ cena: "480" }).data?.cena).toBe(480);
    // Free is a price; the column allows zero and only forbids negatives.
    expect(parsiraj({ cena: "0" }).data?.cena).toBe(0);
  });

  /**
   * The owner chose whole euros. Rounding 120,50 to 120 or 121 without saying
   * so would be a quiet change to the amount he charges, so both spellings of
   * a decimal are refused outright — as are the notations `Number()` accepts
   * and nobody types, exactly as for the passenger count.
   */
  it("refuses decimals and clever notations instead of rounding them", () => {
    for (const zapis of ["120,50", "120.50", "1e3", "0x10", "-5", "480 €"]) {
      expect(greskaZa({ cena: zapis }).cena).toBe(T.greske.cenaNeispravna);
    }
  });

  it("refuses a price that would overflow the column", () => {
    expect(greskaZa({ cena: String(MAX_CENE + 1) }).cena).toBe(
      T.greske.cenaPrevelika,
    );
    expect(parsiraj({ cena: String(MAX_CENE) }).success).toBe(true);
  });

  it("treats a blank note as null, and keeps a written one", () => {
    expect(parsiraj({ napomena: "" }).data?.napomena).toBeNull();
    expect(parsiraj({ napomena: "   " }).data?.napomena).toBeNull();
    expect(parsiraj({ napomena: " dva kofera " }).data?.napomena).toBe(
      "dva kofera",
    );
  });

  it("refuses a note longer than the guardrail", () => {
    expect(greskaZa({ napomena: "a".repeat(MAX_NAPOMENE + 1) }).napomena).toBe(
      T.greske.napomenaPredugacka,
    );
  });
});

/**
 * The Broj putnika stepper.
 *
 * It exists as a function rather than inside the button handler for one
 * reason, and the last case is it: the parent applies it with the functional
 * form of `setState`, so two taps in one frame are two steps. Computing from
 * the rendered value instead lost the second tap, which is exactly how you
 * fail to notice you booked four people instead of five.
 */
describe("pomeriPutnike", () => {
  it("starts from one, whatever the field held", () => {
    expect(pomeriPutnike("", 1)).toBe("1");
    expect(pomeriPutnike("   ", 1)).toBe("1");
    expect(pomeriPutnike("abc", 1)).toBe("1");
  });

  it("steps by one either way", () => {
    expect(pomeriPutnike("4", 1)).toBe("5");
    expect(pomeriPutnike("4", -1)).toBe("3");
  });

  it("never goes below one", () => {
    expect(pomeriPutnike("1", -1)).toBe("1");
    expect(pomeriPutnike("", -1)).toBe("1");
  });

  it("stops at the cap the schema would refuse past", () => {
    expect(pomeriPutnike(String(MAX_PUTNIKA), 1)).toBe(String(MAX_PUTNIKA));
    expect(pomeriPutnike(String(MAX_PUTNIKA + 40), 1)).toBe(String(MAX_PUTNIKA));
  });

  it("composes, which is what makes two quick taps two steps", () => {
    expect(pomeriPutnike(pomeriPutnike("2", 1), 1)).toBe("4");
  });
});
