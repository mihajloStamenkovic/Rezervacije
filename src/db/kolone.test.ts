/**
 * The nine columns are fixed — SPEC §4, standing rule 2.
 *
 * A guard rather than a description: adding `status`, `napomena` or a
 * `created_at` to `reservations` is a one-line change that reads as harmless
 * and is not, and the same is true of switching a `date` column to
 * `timestamp`. Both fail here.
 *
 * Reads the Drizzle table objects directly, so it needs no connection and no
 * environment.
 */
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { destinacije, profiles, reservations, settings } from "./schema";

type Kolona = { name: string; columnType: string; notNull: boolean };

const kolone = (t: unknown) =>
  getTableColumns(t as never) as unknown as Record<string, Kolona>;

describe("reservations — SPEC §4", () => {
  const c = kolone(reservations);

  it("has exactly nine columns, in the order SPEC lists them", () => {
    expect(Object.values(c).map((k) => k.name)).toEqual([
      "id",
      "ime",
      "telefon",
      "destinacija_id",
      "datum_polaska",
      "destinacija_povratka_id",
      "datum_povratka",
      "broj_putnika",
      "kreirao",
    ]);
  });

  it("has no status, no note and no timestamps", () => {
    const imena = Object.values(c).map((k) => k.name);
    for (const zabranjeno of [
      "status",
      "napomena",
      "note",
      "created_at",
      "updated_at",
      "kreirano",
      "izmenjeno",
    ]) {
      expect(imena).not.toContain(zabranjeno);
    }
  });

  it("stores both dates as calendar dates in string mode, never a timestamp", () => {
    // PgDateString is `date(..., { mode: 'string' })`. PgTimestamp* would mean
    // a JS Date crossed the boundary and a timezone could shift it.
    expect(c.datumPolaska?.columnType).toBe("PgDateString");
    expect(c.datumPovratka?.columnType).toBe("PgDateString");
  });

  it("makes the return date the only optional one of the nine", () => {
    const opcione = Object.values(c)
      .filter((k) => !k.notNull)
      .map((k) => k.name);
    expect(opcione).toEqual(["datum_povratka"]);
  });
});

describe("the other three tables", () => {
  it("profiles is the access list, not a credential store", () => {
    const imena = Object.values(kolone(profiles)).map((k) => k.name);
    expect(imena).toEqual(["id", "ime", "email", "boja"]);
    expect(imena).not.toContain("password_hash");
  });

  it("destinacije is one row per city, denormalised (SPEC §5)", () => {
    expect(Object.values(kolone(destinacije)).map((k) => k.name)).toEqual([
      "id",
      "drzava",
      "drzava_sifra",
      "regija",
      "grad",
      "aktivna",
      "redosled",
    ]);
  });

  it("settings is one field and one row", () => {
    expect(Object.values(kolone(settings)).map((k) => k.name)).toEqual([
      "id",
      "podrazumevana_destinacija_id",
    ]);
  });
});
