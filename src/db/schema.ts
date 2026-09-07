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
 * A team — the unit of visibility (migration `0004`).
 *
 * Called `tim` rather than `grupa` because `grupa` already means the
 * *Polasci / Povratci* day grouping throughout `src/domen/liste.ts` and
 * `src/lib/tekst.ts`. Two meanings for one word in a codebase this small is a
 * bug waiting to be written.
 *
 * Rows are not deleted: a team is referenced by every profile in it, and a
 * profile cannot be deleted either (see `profiles.aktivan`). An unused team is
 * simply left standing.
 */
export const timovi = pgTable("timovi", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Display name, e.g. `Prevoz A`. Unique so two teams cannot be confused. */
  naziv: text("naziv").notNull().unique(),
}).enableRLS();

/**
 * Who may enter, what they may do, and whose bookings they may see.
 *
 * `id` mirrors, and since migration `0002` is a real foreign key to,
 * `auth.users.id` — Supabase Auth owns the credentials, so there is no
 * password column here (SPEC §4 predates the Supabase decision in §9).
 *
 * Migration `0004` turned this from a flat access list into the whole
 * authorisation model:
 *
 *   - `uloga` — `admin` sees and manages everything; `korisnik` is a driver.
 *   - `timId` — which team a driver belongs to. `null` for admins, required
 *     for drivers, enforced by a CHECK rather than by convention.
 *   - `aktivan` — soft revocation. It has to be soft: `reservations.kreirao`
 *     is `ON DELETE RESTRICT` and `profiles.id → auth.users.id` is
 *     `ON DELETE CASCADE`, so once someone has entered a booking they cannot
 *     be deleted from either end. Flipping this to false is the only way to
 *     take access away.
 *
 * **A reservation has no team column.** Visibility is a property of people and
 * a booking inherits its author's, through `reservations.kreirao`. That keeps
 * the nine reservation columns fixed (standing rule 2) and means there is one
 * place to change who sees what.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    ime: text("ime").notNull(),
    email: text("email").notNull().unique(),
    /** Badge colour, stored as a hex string like `#2563eb`. */
    boja: text("boja").notNull(),
    /** `admin` or `korisnik`. Constrained below, not by a Postgres enum —
     *  adding a third role should be a migration, not a type change. */
    uloga: text("uloga").notNull().default("korisnik"),
    /** The team whose bookings this person shares. Null only for admins. */
    timId: uuid("tim_id").references(() => timovi.id, {
      onDelete: "restrict",
    }),
    /** False locks the account out on its next request. */
    aktivan: boolean("aktivan").notNull().default(true),
  },
  (t) => [
    check("profiles_uloga_dozvoljena", sql`${t.uloga} in ('admin', 'korisnik')`),
    // An admin belongs to no team and sees everything; a driver must belong to
    // exactly one. Neither half is optional, so neither is left to the app.
    check(
      "profiles_tim_prema_ulozi",
      sql`(${t.uloga} = 'admin' and ${t.timId} is null)
          or (${t.uloga} = 'korisnik' and ${t.timId} is not null)`,
    ),
    index("profiles_tim_id_idx").on(t.timId),
  ],
).enableRLS();

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
 * Ten columns: the nine that describe the trip, plus `tim_id`, which decides
 * who may see it.
 *
 * Standing rule 2 fixed this table at nine and was amended on 06.09.2026 to
 * say what it always meant — *the nine columns describing the trip* are fixed.
 * The forbidden list it was written against is still forbidden: no `status`,
 * no `napomena`, no timestamps. `tim_id` is not trip data creeping in, it is
 * the access model, and it is here rather than derived from `kreirao` for one
 * concrete reason:
 *
 * The owners are the dispatchers. They take the phone calls and enter the
 * bookings that the drivers then drive. With visibility derived from the
 * author, every booking an owner entered would be invisible to the driver who
 * has to make the trip — silently, because an absent booking is
 * indistinguishable from a quiet day. Storing the team on the booking is what
 * lets an owner enter a trip *for* a crew.
 *
 * `null` means the booking is visible to administrators only. That is a real
 * choice on the form, not an accident.
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Booking name — one name covers the whole group. */
    ime: text("ime").notNull(),
    /** Normalised to E.164 (`+381…`) on save so it dials from abroad. */
    telefon: text("telefon").notNull(),
    /**
     * Where the van picks them up — a street address in Belgrade (migration
     * `0005`, at the owner's request 07.09.2026).
     *
     * Free text, not reference data. Standing rule 3 governs *destinations*,
     * which are what the list filters and groups on; a doorstep is dictated
     * over the phone, is never filtered on, and would turn the destination
     * table into an address book if it were seeded there.
     *
     * Nullable although the form requires it, because every booking entered
     * before this column existed has no address and none can be invented for
     * it. Required-for-new lives in `RezervacijaSchema`, which is the only
     * place that can tell a new booking from an old one.
     */
    adresa: text("adresa"),
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
    /**
     * What the trip costs, in **whole euros** (migration `0005`).
     *
     * `integer` rather than `numeric`, at the owner's choice 07.09.2026: the
     * business quotes round figures. That also keeps money off floating point
     * for free — there are no cents to lose — so nothing here ever needs
     * rounding, and the column stores exactly what was typed.
     *
     * Nullable for the same reason as `adresa`: bookings predating the column.
     */
    cena: integer("cena"),
    /**
     * A free-text description of the booking — anything the nine columns have
     * no room for (migration `0005`).
     *
     * SPEC §4 said "no notes" and meant it; this reverses that at the owner's
     * request, and §4 records the reversal rather than being quietly
     * contradicted. It stays outside every list, filter and sort: a note is
     * read on Detalji, by someone who already found the booking.
     *
     * `null` is the absence of a note, never `''`. One empty state, so
     * "has a note" is a null check everywhere.
     */
    napomena: text("napomena"),
    /**
     * Who entered it. A badge, never a permission — everyone on the team may
     * edit and delete everyone else's bookings, which is what makes it a
     * shared book (reaffirmed 06.09.2026).
     */
    kreirao: uuid("kreirao")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    /**
     * Which team may see this booking. `null` = administrators only.
     *
     * `ON DELETE RESTRICT` for the same reason as the destination columns: a
     * team that still has bookings against it cannot be deleted out from
     * under them.
     */
    timId: uuid("tim_id").references(() => timovi.id, {
      onDelete: "restrict",
    }),
  },
  (t) => [
    check("reservations_broj_putnika_pozitivan", sql`${t.brojPutnika} > 0`),
    // A price may be absent or free, never negative.
    check("reservations_cena_nenegativna", sql`${t.cena} is null or ${t.cena} >= 0`),
    // A return cannot precede its departure.
    check(
      "reservations_povratak_posle_polaska",
      sql`${t.datumPovratka} is null or ${t.datumPovratka} >= ${t.datumPolaska}`,
    ),
    // The two list modes scan on these two columns and nothing else.
    index("reservations_datum_polaska_idx").on(t.datumPolaska),
    index("reservations_datum_povratka_idx").on(t.datumPovratka),
    // Every list read now filters on this first.
    index("reservations_tim_id_idx").on(t.timId),
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
export type Tim = typeof timovi.$inferSelect;
export type Destinacija = typeof destinacije.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type Settings = typeof settings.$inferSelect;
