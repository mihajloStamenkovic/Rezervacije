/**
 * The reservation form schema.
 *
 * These are the cases where a wrong answer reaches the database: a phone that
 * will not dial from abroad, an empty return date stored as `""`, or a return
 * before its departure.
 */
import { describe, expect, it } from "vitest";
import {
  RezervacijaSchema,
  greskePolja,
  izFormData,
  type UlazRezervacije,
} from "./validacija";
import { T } from "./tekst";

const BEOGRAD = "00000000-0000-4000-8000-200000000001";
const HANIOTI = "00000000-0000-4000-8000-200000000005";

const ispravan: UlazRezervacije = {
  ime: "Marko Petrović",
  telefon: "064 123 4567",
  destinacijaId: HANIOTI,
  datumPolaska: "2026-01-01",
  destinacijaPovratkaId: BEOGRAD,
  datumPovratka: "2026-01-15",
  brojPutnika: "4",
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

  it("distinguishes a missing departure date from a malformed one", () => {
    expect(greskaZa({ datumPolaska: "" }).datumPolaska).toBe(
      T.greske.datumPolaskaObavezan,
    );
    expect(greskaZa({ datumPolaska: "01.01.2026." }).datumPolaska).toBe(
      T.greske.datumNeispravan,
    );
  });

  it("rejects anything that is not a destination id", () => {
    expect(greskaZa({ destinacijaId: "" }).destinacijaId).toBe(
      T.greske.destinacijaObavezna,
    );
    expect(greskaZa({ destinacijaPovratkaId: "Grčka" }).destinacijaPovratkaId).toBe(
      T.greske.destinacijaObavezna,
    );
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
    fd.set("destinacijaId", HANIOTI);
    fd.set("datumPolaska", "2026-01-01");
    fd.set("destinacijaPovratkaId", BEOGRAD);
    fd.set("brojPutnika", "2");
    // datumPovratka deliberately absent — the return is not agreed yet.

    const ulaz = izFormData(fd);
    expect(ulaz.datumPovratka).toBe("");

    const r = RezervacijaSchema.safeParse(ulaz);
    expect(r.success).toBe(true);
    expect(r.data?.datumPovratka).toBeNull();
    expect(r.data?.telefon).toBe("+381641234567");
  });
});
