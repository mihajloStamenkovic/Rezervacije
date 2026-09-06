/**
 * Who may see which reservations — the authorisation rule, as pure functions.
 *
 * The rule in one sentence:
 *
 * > An **admin** sees every reservation. A **korisnik** sees the reservations
 * > belonging to their own team.
 *
 * A booking carries its own `tim_id`, chosen when it is entered. A driver's
 * bookings default to that driver's team; an owner picks the team on the form,
 * because the owners are the dispatchers and most bookings they enter are for
 * somebody else to drive. `tim_id = null` means administrators only, and it is
 * an option on the form rather than something that happens by accident.
 *
 * **Why the team is on the booking and not derived from its author.** The
 * derived version was designed first and discarded on 06.09.2026: with it,
 * every booking an owner entered would have been invisible to the driver who
 * had to make the trip. Silently — an absent booking looks exactly like a
 * quiet day. Storing it makes two further things true that the derived version
 * got wrong: history is frozen, so moving somebody between teams cannot
 * retroactively hand their old customers' names and phone numbers to a
 * different crew; and a booking can be reassigned with one edit.
 *
 * `aktivan` deliberately does **not** appear here. It governs whether an
 * account may sign in; a deactivated driver's bookings stay visible to their
 * team, which is exactly what the team needs after that person stops working.
 * If `aktivan` were part of this rule, deactivating somebody would silently
 * empty their team's schedule.
 *
 * **This file is the mirror of the SQL, not the enforcement.** The app reads
 * through Drizzle as the table owner and bypasses RLS entirely
 * (`src/db/index.ts`, `SPEC.md` §9), so the `WHERE` clause built in
 * `src/db/vidljivost.ts` is what actually holds the line, and the RLS policies
 * in migration `0004` are the second boundary, for the PostgREST surface. The
 * two are written separately on purpose — they defend different doors — and
 * `npm run provera:vidljivost` asserts they agree on real data.
 */
import type { Profile } from "./tipovi";

/**
 * What the team dropdown submits for "administrators only".
 *
 * A sentinel rather than an empty string, because the form and the Server
 * Action need to tell three states apart: a real team, deliberately
 * administrators-only, and *the field was never rendered* — which is what a
 * driver's form sends and which must be read as "my own team". An empty value
 * is already spoken for by the third.
 *
 * It lives here rather than beside the action because a `"use server"` module
 * may only export async functions.
 */
export const SAMO_ADMINI = "samo-admini";

/** An account that sees every team and may manage who else may enter. */
export function jeAdmin(profil: Pick<Profile, "uloga">): boolean {
  return profil.uloga === "admin";
}

/**
 * May `vidilac` see a reservation belonging to team `timId`?
 *
 * `timId` is the reservation's own column — `null` for an administrators-only
 * booking — not its author's team.
 */
export function mozeVideti(
  vidilac: Pick<Profile, "uloga" | "timId">,
  timId: string | null,
): boolean {
  if (jeAdmin(vidilac)) return true;

  // Two nulls must never match. A korisnik always has a team (the CHECK in
  // migration 0004 guarantees it) and an admin-only booking has none, so
  // `null === null` would hand every private booking to every driver.
  return timId !== null && vidilac.timId !== null && vidilac.timId === timId;
}

/**
 * Which team a booking should be filed under when this person enters one
 * without being asked.
 *
 * A driver can only ever book for their own team, so the form does not ask
 * them. An admin belongs to no team, so the answer is `null` —
 * administrators-only — and the form *must* ask them instead of accepting
 * this default silently.
 */
export function podrazumevaniTim(
  autor: Pick<Profile, "uloga" | "timId">,
): string | null {
  return jeAdmin(autor) ? null : autor.timId;
}

/**
 * May `vidilac` choose to file a booking under team `timId`?
 *
 * Admins may file under any team, or under none. A driver may only ever file
 * under their own — this is what stops a form field from becoming a way to
 * write into another crew's schedule.
 */
export function smeDaDodeli(
  vidilac: Pick<Profile, "uloga" | "timId">,
  timId: string | null,
): boolean {
  if (jeAdmin(vidilac)) return true;
  return timId !== null && timId === vidilac.timId;
}

/**
 * May `vidilac` see that account `drugi` exists at all — in a member list, a
 * badge, a delete confirmation?
 *
 * The owners asked that a driver not learn of accounts outside their team.
 * Everyone can always see themselves, without which an admin would vanish
 * from their own screens.
 */
export function mozeVidetiProfil(
  vidilac: Pick<Profile, "id" | "uloga" | "timId">,
  drugi: Pick<Profile, "id" | "uloga" | "timId">,
): boolean {
  if (vidilac.id === drugi.id) return true;
  if (jeAdmin(vidilac)) return true;
  if (jeAdmin(drugi)) return false;
  return mozeVideti(vidilac, drugi.timId);
}
