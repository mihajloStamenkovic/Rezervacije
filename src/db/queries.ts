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
import { and, asc, eq } from "drizzle-orm";
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

/** Every destination, active or not. Ordered for display: country, then order. */
export async function sveDestinacije(): Promise<Destinacija[]> {
  return db
    .select()
    .from(destinacije)
    .orderBy(asc(destinacije.drzava), asc(destinacije.redosled));
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
