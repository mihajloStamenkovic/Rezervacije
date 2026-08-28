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
import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  destinacije,
  profiles,
  reservations,
  settings,
  type Destinacija,
  type NewReservation,
  type Profile,
  type Reservation,
} from "./schema";

/** A reservation with both destination rows and its author already resolved. */
export type RezervacijaRed = {
  rezervacija: Reservation;
  destinacija: Destinacija;
  destinacijaPovratka: Destinacija;
  autor: Profile;
};

const odrediste = alias(destinacije, "odrediste");
const povratak = alias(destinacije, "povratak");

function joinedSelect() {
  return db
    .select({
      rezervacija: reservations,
      destinacija: odrediste,
      destinacijaPovratka: povratak,
      autor: profiles,
    })
    .from(reservations)
    .innerJoin(odrediste, eq(reservations.destinacijaId, odrediste.id))
    .innerJoin(povratak, eq(reservations.destinacijaPovratkaId, povratak.id))
    .innerJoin(profiles, eq(reservations.kreirao, profiles.id));
}

/**
 * Every reservation, unfiltered and in no meaningful order.
 *
 * Deliberately unfiltered: which rows belong on the list depends on today's
 * date in Belgrade and on the main leg rule, and that decision is the domain
 * core's, not this file's.
 */
export async function sveRezervacije(): Promise<RezervacijaRed[]> {
  return joinedSelect();
}

export async function rezervacijaPoId(
  id: string,
): Promise<RezervacijaRed | null> {
  const [red] = await joinedSelect().where(eq(reservations.id, id)).limit(1);
  return red ?? null;
}

/** Every destination, active or not. Ordered for display: country, then order. */
export async function sveDestinacije(): Promise<Destinacija[]> {
  return db
    .select()
    .from(destinacije)
    .orderBy(asc(destinacije.drzava), asc(destinacije.redosled));
}

/** Only what may be offered for a new booking (SPEC §5). */
export async function aktivneDestinacije(): Promise<Destinacija[]> {
  return db
    .select()
    .from(destinacije)
    .where(eq(destinacije.aktivna, true))
    .orderBy(asc(destinacije.drzava), asc(destinacije.redosled));
}

export async function sviProfili(): Promise<Profile[]> {
  return db.select().from(profiles).orderBy(asc(profiles.ime));
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

export async function izmeniRezervaciju(
  id: string,
  vrednosti: Partial<NewReservation>,
) {
  const [red] = await db
    .update(reservations)
    .set(vrednosti)
    .where(eq(reservations.id, id))
    .returning();
  return red ?? null;
}

/** Permanent. There is no status column and no undo (SPEC §8). */
export async function obrisiRezervaciju(id: string): Promise<boolean> {
  const obrisano = await db
    .delete(reservations)
    .where(eq(reservations.id, id))
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
