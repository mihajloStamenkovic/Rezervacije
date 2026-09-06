/**
 * The query layer. Raw rows only.
 *
 * Nothing here knows about the main leg rule, the two list modes, or the
 * filters — those live in the domain core (`src/domen/`) so they can be tested
 * without a database. This file's whole job is to hand over rows.
 *
 * The one thing it does decide is *shape*: a reservation is almost never
 * useful without its two destination rows resolved, so the joined read is the
 * default. It joins rather than filtering on `aktivna`, because an inactive
 * destination must still render on an existing booking (SPEC §5).
 */
import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { uslovZa } from "./vidljivost";
import {
  destinacije,
  profiles,
  reservations,
  settings,
  timovi,
  type Destinacija,
  type NewReservation,
  type Profile,
  type Reservation,
  type Tim,
} from "./schema";

/** Just enough of the author to draw a badge. See `joinedSelect`. */
export type AutorBedza = Pick<Profile, "id" | "ime" | "boja">;

/** A reservation with both destination rows and its author already resolved. */
export type RezervacijaRed = {
  rezervacija: Reservation;
  destinacija: Destinacija;
  destinacijaPovratka: Destinacija;
  autor: AutorBedza;
};

const odrediste = alias(destinacije, "odrediste");
const povratak = alias(destinacije, "povratak");

function joinedSelect() {
  return db
    .select({
      rezervacija: reservations,
      destinacija: odrediste,
      destinacijaPovratka: povratak,
      // Only what a badge needs. `profiles` wholesale used to be selected
      // here, which put every author's email address into the RSC payload of
      // every card, and since migration 0004 would have shipped their role and
      // team as well. Nothing renders those.
      autor: {
        id: profiles.id,
        ime: profiles.ime,
        boja: profiles.boja,
      },
    })
    .from(reservations)
    .innerJoin(odrediste, eq(reservations.destinacijaId, odrediste.id))
    .innerJoin(povratak, eq(reservations.destinacijaPovratkaId, povratak.id))
    .innerJoin(profiles, eq(reservations.kreirao, profiles.id));
}

/**
 * Every reservation **this person may see**, in no meaningful order.
 *
 * Unordered and unfiltered by date on purpose: which rows belong on the list
 * depends on today's date in Belgrade and on the main leg rule, and that
 * decision is the domain core's, not this file's. Who may see them is not the
 * domain core's, and is decided here.
 *
 * There is no unscoped variant of this function, and adding one back would
 * undo the entire access model — the app bypasses RLS (see
 * `src/db/vidljivost.ts`), so this `WHERE` clause is the boundary.
 */
export async function rezervacijeZa(
  vidilac: Pick<Profile, "uloga" | "timId">,
): Promise<RezervacijaRed[]> {
  return joinedSelect().where(uslovZa(vidilac));
}

/**
 * One reservation, or `null` when it does not exist **or is not this person's
 * to see**.
 *
 * Collapsing those two into one answer is deliberate: every caller already
 * renders `null` as `notFound()`, so a guessed id from another team is
 * indistinguishable from a typo, and the app never confirms that a booking
 * exists to somebody who may not read it.
 */
export async function rezervacijaZa(
  vidilac: Pick<Profile, "uloga" | "timId">,
  id: string,
): Promise<RezervacijaRed | null> {
  const [red] = await joinedSelect()
    .where(and(eq(reservations.id, id), uslovZa(vidilac)))
    .limit(1);
  return red ?? null;
}

/**
 * The teams this person may file a booking under, in Serbian alphabetical
 * order.
 *
 * Empty for a driver — not because they have no team, but because they have
 * exactly one and the form does not ask a question with a single answer. The
 * Server Action reads that absence as "my own team".
 */
export async function timoviZa(
  vidilac: Pick<Profile, "uloga" | "timId">,
): Promise<Tim[]> {
  if (vidilac.uloga !== "admin") return [];
  return db.select().from(timovi).orderBy(asc(timovi.naziv));
}

/**
 * Every account and every team, for the admin screen.
 *
 * Unscoped on purpose and safe to be: the only caller is `/nalozi`, which
 * begins with `zahtevajAdmina()`. Named so that reaching for it by mistake
 * reads wrong — there is no `sviProfili()`.
 */
export async function sviProfiliZaAdmina(): Promise<Profile[]> {
  return db.select().from(profiles).orderBy(asc(profiles.ime));
}

export async function sviTimoviZaAdmina(): Promise<Tim[]> {
  return db.select().from(timovi).orderBy(asc(timovi.naziv));
}

export async function napraviTim(naziv: string): Promise<Tim> {
  const [red] = await db.insert(timovi).values({ naziv }).returning();
  return red!;
}

/**
 * Writes the `profiles` row for an account that already exists in
 * `auth.users`.
 *
 * The email is read from `auth.users` rather than accepted as an argument, the
 * same way `src/db/seed.ts` does it: `profiles.id` is a real foreign key, so
 * the account must exist anyway, and this keeps an address from ever being a
 * value this layer invents.
 */
export async function upisiProfil(vrednosti: {
  id: string;
  ime: string;
  boja: string;
  uloga: string;
  timId: string | null;
}): Promise<boolean> {
  // Raw SQL for the same reason `src/db/seed.ts` uses it: the email is
  // selected out of `auth.users`, a table the Drizzle schema models by its
  // primary key alone because Supabase owns it.
  const redovi = await db.execute(sql`
    insert into profiles (id, ime, email, boja, uloga, tim_id, aktivan)
    select id, ${vrednosti.ime}, email, ${vrednosti.boja},
           ${vrednosti.uloga}, ${vrednosti.timId}::uuid, true
    from auth.users
    where id = ${vrednosti.id}
    returning id
  `);
  return redovi.length > 0;
}

/** Role, team or active state. The admin screen's only write to a profile. */
export async function izmeniProfil(
  id: string,
  vrednosti: Partial<Pick<Profile, "ime" | "boja" | "uloga" | "timId" | "aktivan">>,
): Promise<Profile | null> {
  const [red] = await db
    .update(profiles)
    .set(vrednosti)
    .where(eq(profiles.id, id))
    .returning();
  return red ?? null;
}

/** Every destination, active or not. Ordered for display: country, then order. */
export async function sveDestinacije(): Promise<Destinacija[]> {
  return db
    .select()
    .from(destinacije)
    .orderBy(asc(destinacije.drzava), asc(destinacije.redosled));
}

/**
 * Add a destination the owner typed by hand, or hand back the row that is
 * already there — SPEC §5, amended 06.09.2026.
 *
 * The caller has already matched the typed name against the catalogue folded
 * for case and diacritics, so reaching the conflict clause means two people
 * typed the same new town at the same moment. `DO UPDATE` with a self-assign
 * rather than `DO NOTHING` because `DO NOTHING` returns no row on conflict,
 * and the caller needs an id either way. The existing row is not touched: it
 * may be an inactive one the seed manages, and this must not quietly
 * reactivate it.
 */
export async function dodajDestinaciju(
  vrednosti: typeof destinacije.$inferInsert,
): Promise<Destinacija> {
  const [red] = await db
    .insert(destinacije)
    .values(vrednosti)
    .onConflictDoUpdate({
      target: [destinacije.drzavaSifra, destinacije.regija, destinacije.grad],
      set: { drzava: sql`${destinacije.drzava}` },
    })
    .returning();
  return red;
}

/**
 * One profile, or `null` when the account is not on the access list.
 *
 * `null` is the whole point of this query: since migration 0003 a `profiles`
 * row is what grants access, so "no row" is the answer that locks someone
 * out. It reads through Drizzle, which connects as the table owner and
 * bypasses RLS — deliberately, because this is the query that decides whether
 * RLS would have let them in, and it must not be subject to the rule it is
 * checking.
 *
 * Since migration `0004` it also requires `aktivan`. Deactivating somebody is
 * the only way to revoke access — their `profiles` row cannot be deleted while
 * they have entered a booking — so this is where that revocation takes effect.
 * The three places that ask "may this person be here" must agree: this one,
 * the proxy's own check in `src/lib/supabase/middleware.ts`, and `prijaviSe`.
 * If they disagree, a deactivated account ping-pongs between `/` and
 * `/prijava` instead of being turned away.
 */
export async function profilPoId(id: string): Promise<Profile | null> {
  const [red] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.aktivan, true)))
    .limit(1);
  return red ?? null;
}

/** The single settings row, or `null` before it has been written. */
export async function podesavanja() {
  const [red] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return red ?? null;
}

export async function upisiRezervaciju(vrednosti: NewReservation) {
  const [red] = await db.insert(reservations).values(vrednosti).returning();
  return red;
}

/**
 * Edit, scoped. Returns `null` when the row is not this person's to change.
 *
 * The visibility condition is part of the `WHERE`, not an `if` in the Server
 * Action ahead of the call. That is not a style preference: read-then-write
 * leaves a window between the check and the change, and putting both in one
 * statement closes it. It also means "not yours" and "not found" come back as
 * the same answer from the same query.
 */
export async function izmeniRezervaciju(
  vidilac: Pick<Profile, "uloga" | "timId">,
  id: string,
  vrednosti: Partial<NewReservation>,
) {
  const [red] = await db
    .update(reservations)
    .set(vrednosti)
    .where(and(eq(reservations.id, id), uslovZa(vidilac)))
    .returning();
  return red ?? null;
}

/**
 * Permanent. There is no status column and no undo (SPEC §8).
 *
 * Scoped in the same statement as the delete, for the same reason as the edit
 * above — and here the window mattered more, because the old code read the row
 * first and then deleted by id alone.
 */
export async function obrisiRezervaciju(
  vidilac: Pick<Profile, "uloga" | "timId">,
  id: string,
): Promise<boolean> {
  const obrisano = await db
    .delete(reservations)
    .where(and(eq(reservations.id, id), uslovZa(vidilac)))
    .returning({ id: reservations.id });
  return obrisano.length > 0;
}

export async function postaviPodrazumevanuDestinaciju(destinacijaId: string) {
  const [red] = await db
    .insert(settings)
    .values({ id: 1, podrazumevanaDestinacijaId: destinacijaId })
    .onConflictDoUpdate({
      target: settings.id,
      set: { podrazumevanaDestinacijaId: destinacijaId },
    })
    .returning();
  return red;
}
