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
import {
  destinacije,
  profiles,
  reservations,
  settings,
  timovi,
} from "./schema";

type Kolona = { name: string; columnType: string; notNull: boolean };

const kolone = (t: unknown) =>
  getTableColumns(t as never) as unknown as Record<string, Kolona>;

describe("reservations — SPEC §4", () => {
  const c = kolone(reservations);

  it("has the nine trip columns, in the order SPEC lists them, plus tim_id", () => {
    // Standing rule 2 was amended 06.09.2026: the nine columns *describing the
    // trip* are fixed. `tim_id` is not trip data — it is who may see the row —
    // and it is stored rather than derived from `kreirao` because the owners
    // are the dispatchers: a booking an owner enters for a crew has to reach
    // that crew. See src/domen/pristup.ts for the reasoning in full.
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
      "tim_id",
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

  it("leaves only the return date and the team optional", () => {
    // `tim_id` is nullable because null is meaningful: administrators only.
    // Every trip column except the return date stays required.
    const opcione = Object.values(c)
      .filter((k) => !k.notNull)
      .map((k) => k.name);
    expect(opcione).toEqual(["datum_povratka", "tim_id"]);
  });
});

describe("the other three tables", () => {
  it("profiles is the access list, not a credential store", () => {
    // Migration 0004 added the last three: `profiles` now carries the whole
    // authorisation model, which is why it is allowed to grow where
    // `reservations` is not. Still no credentials — that is the invariant
    // this test has always been about, and it has not moved.
    const imena = Object.values(kolone(profiles)).map((k) => k.name);
    expect(imena).toEqual([
      "id",
      "ime",
      "email",
      "boja",
      "uloga",
      "tim_id",
      "aktivan",
    ]);
    expect(imena).not.toContain("password_hash");
    expect(imena).not.toContain("lozinka");
  });

  it("a driver must have a team and an admin must not", () => {
    // The rule lives in a CHECK rather than in the app, so a row that would
    // make `mozeVideti` ambiguous cannot be written at all.
    const c = kolone(profiles);
    expect(c.uloga?.notNull).toBe(true);
    expect(c.aktivan?.notNull).toBe(true);
    // tim_id is the one that is nullable — null is how an admin is stored.
    expect(c.timId?.notNull).toBe(false);
  });

  it("timovi is a name and nothing more", () => {
    expect(Object.values(kolone(timovi)).map((k) => k.name)).toEqual([
      "id",
      "naziv",
    ]);
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
