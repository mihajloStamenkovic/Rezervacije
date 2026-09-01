/**
 * Drizzle schema — Kombi Rezervacije.
 *
 * See SPEC.md §4 (model podataka) and §5 (destinacije as reference data).
 *
 * Three rules this file exists to enforce:
 *
 *   1. Dates are calendar dates. Every date column is `date` in
 *      `{ mode: 'string' }` so it arrives as `YYYY-MM-DD` and never becomes a
 *      JS `Date` — no timezone can shift it. Never `timestamp`.
 *   2. Destinations are reference data. Both destination columns are foreign
 *      keys, `ON DELETE RESTRICT`, so a destination row can never be deleted
 *      out from under a reservation that points at it.
 *   3. Every table has RLS enabled. Until the auth phase writes policies this
 *      is default-deny: the publishable key reads nothing. Server queries are
 *      unaffected because they connect as `postgres`, which owns the tables
 *      and so bypasses RLS. Never drop `.enableRLS()` from a table here.
 */
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * A read-only handle onto Supabase Auth's own `auth.users` table, just
 * enough of it (the primary key) to hang a foreign key off. This schema and
 * table are owned and managed by Supabase, not by drizzle-kit — migrations
 * never create, alter or drop it, only reference its `id` column.
 */
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/**
 * The two accounts. `id` mirrors, and since migration `0002` is a real
 * foreign key to, `auth.users.id` — Supabase Auth owns the credentials, so
 * there is no password column here (SPEC §4 predates the Supabase decision
 * in §9; see the build report).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  ime: text("ime").notNull(),
  email: text("email").notNull().unique(),
  /** Badge colour, stored as a hex string like `#2563eb`. */
  boja: text("boja").notNull(),
}).enableRLS();

/**
 * One row per city. Country and region are denormalised onto it — 44 rows do
 * not justify a three-table join (SPEC §5).
 *
 * Rows are never deleted, only flipped to `aktivna = false`: an inactive
 * destination is hidden from the new-reservation dropdowns but must still
 * resolve for existing reservations.
 */
export const destinacije = pgTable(
  "destinacije",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Display name, e.g. `Grčka`. */
    drzava: text("drzava").notNull(),
    /** Stable key for re-seeding, e.g. `grcka`. Never changes. */
    drzavaSifra: text("drzava_sifra").notNull(),
    /** e.g. `Kasandra`. */
    regija: text("regija").notNull(),
    /** e.g. `Hanioti`. */
    grad: text("grad").notNull(),
    /** Offerable for new bookings. Inactive rows still resolve. */
    aktivna: boolean("aktivna").notNull().default(true),
    /** Display order within its country. */
    redosled: integer("redosled").notNull().default(0),
  },
  (t) => [
    // The seed's idempotency key (SPEC §5, "Keeping the data current").
    unique("destinacije_kljuc").on(t.drzavaSifra, t.regija, t.grad),
    index("destinacije_drzava_sifra_idx").on(t.drzavaSifra),
    index("destinacije_aktivna_idx").on(t.aktivna),
  ],
).enableRLS();

/**
 * The nine columns. No status, no notes, no timestamps — removed deliberately
 * (build_plan standing rule 2).
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Booking name — one name covers the whole group. */
    ime: text("ime").notNull(),
    /** Normalised to E.164 (`+381…`) on save so it dials from abroad. */
    telefon: text("telefon").notNull(),
    /** Trip destination. */
    destinacijaId: uuid("destinacija_id")
      .notNull()
      .references(() => destinacije.id, { onDelete: "restrict" }),
    datumPolaska: date("datum_polaska", { mode: "string" }).notNull(),
    /** Where they come back to. Pre-filled from settings, editable. */
    destinacijaPovratkaId: uuid("destinacija_povratka_id")
      .notNull()
      .references(() => destinacije.id, { onDelete: "restrict" }),
    /** Optional — filled in later when the return is confirmed. */
    datumPovratka: date("datum_povratka", { mode: "string" }),
    brojPutnika: integer("broj_putnika").notNull(),
    /** Which of the two accounts entered it. */
    kreirao: uuid("kreirao")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
  },
  (t) => [
    check("reservations_broj_putnika_pozitivan", sql`${t.brojPutnika} > 0`),
    // A return cannot precede its departure.
    check(
      "reservations_povratak_posle_polaska",
      sql`${t.datumPovratka} is null or ${t.datumPovratka} >= ${t.datumPolaska}`,
    ),
    // The two list modes scan on these two columns and nothing else.
    index("reservations_datum_polaska_idx").on(t.datumPolaska),
    index("reservations_datum_povratka_idx").on(t.datumPovratka),
  ],
).enableRLS();

/**
 * Podešavanja — one field, one row, forever. The `id = 1` check is what makes
 * "one row" a database guarantee rather than a convention.
 */
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    /** Default home destination, pre-filled into the return leg. */
    podrazumevanaDestinacijaId: uuid("podrazumevana_destinacija_id")
      .notNull()
      .references(() => destinacije.id, { onDelete: "restrict" }),
  },
  (t) => [check("settings_jedan_red", sql`${t.id} = 1`)],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Destinacija = typeof destinacije.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type Settings = typeof settings.$inferSelect;
