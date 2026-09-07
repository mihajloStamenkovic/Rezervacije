/**
 * The reservation columns are fixed — SPEC §4, standing rule 2.
 *
 * A guard rather than a description: adding a column to `reservations` is a
 * one-line change that reads as harmless and is not, and the same is true of
 * switching a `date` column to `timestamp`. Both fail here.
 *
 * **Amended 07.09.2026.** The owner asked for three more: `adresa` (the
 * doorstep in Belgrade), `cena` (whole euros) and `napomena` (a free-text
 * description). That last one reverses SPEC §4's "no notes" outright, so the
 * reversal is written down here and in SPEC rather than being absorbed
 * silently — which is what this file is for. What has *not* moved:
 * `reservations` still carries no `status` and no timestamps, and the column
 * list below is still exhaustive, so the next addition fails here too.
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

  it("has exactly the columns SPEC §4 lists, in that order", () => {
    // Two amendments are folded into this list, both at the owner's request
    // and both written into SPEC rather than resolved here:
    //
    //   06.09.2026 — `tim_id`. Not trip data: it is who may see the row, and
    //   it is stored rather than derived from `kreirao` because the owners are
    //   the dispatchers, so a booking an owner enters for a crew has to reach
    //   that crew. See src/domen/pristup.ts for the reasoning in full.
    //
    //   07.09.2026 — `adresa`, `cena` and `napomena`. The first two are trip
    //   data in the plainest sense: where the van stops and what the trip
    //   costs. `napomena` is the one that reverses a decision rather than
    //   extending it; see this file's header.
    expect(Object.values(c).map((k) => k.name)).toEqual([
      "id",
      "ime",
      "telefon",
      "adresa",
      "destinacija_id",
      "datum_polaska",
      "destinacija_povratka_id",
      "datum_povratka",
      "broj_putnika",
      "cena",
      "napomena",
      "kreirao",
      "tim_id",
    ]);
  });

  it("still has no status and no timestamps", () => {
    // `napomena` left this list on 07.09.2026 and nothing else did. A status
    // column would put a booking in a state the list could hide it in, and
    // timestamps were refused because nobody was going to read them.
    const imena = Object.values(c).map((k) => k.name);
    for (const zabranjeno of [
      "status",
      "created_at",
      "updated_at",
      "kreirano",
      "izmenjeno",
    ]) {
      expect(imena).not.toContain(zabranjeno);
    }
  });

  it("keeps the price an integer of euros, never a float", () => {
    // The owner chose whole euros (SPEC §4, amended). `integer` is what makes
    // "no cents to lose" a property of the column rather than of the form.
    expect(c.cena?.columnType).toBe("PgInteger");
  });

  it("stores both dates as calendar dates in string mode, never a timestamp", () => {
    // PgDateString is `date(..., { mode: 'string' })`. PgTimestamp* would mean
    // a JS Date crossed the boundary and a timezone could shift it.
    expect(c.datumPolaska?.columnType).toBe("PgDateString");
    expect(c.datumPovratka?.columnType).toBe("PgDateString");
  });

  it("leaves nullable only what has a meaning when absent", () => {
    // `datum_povratka` — the return is not agreed yet (SPEC §8).
    // `tim_id` — null is meaningful: administrators only.
    // `adresa`, `cena`, `napomena` — nullable in the column although the form
    //   requires the first two, because every booking entered before
    //   07.09.2026 has none of them and none can be invented. Required-for-new
    //   lives in `RezervacijaSchema`, the only place that can tell a new
    //   booking from an old one; see src/lib/validacija.ts.
    const opcione = Object.values(c)
      .filter((k) => !k.notNull)
      .map((k) => k.name);
    expect(opcione).toEqual([
      "adresa",
      "datum_povratka",
      "cena",
      "napomena",
      "tim_id",
    ]);
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
