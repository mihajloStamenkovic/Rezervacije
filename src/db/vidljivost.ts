/**
 * The visibility predicate — the boundary that actually holds.
 *
 * The app reads and writes through Drizzle, which connects as `postgres`, owns
 * the tables and therefore **bypasses row-level security entirely**
 * (`src/db/index.ts`, `SPEC.md` §9). The RLS policies in migration `0004`
 * guard the PostgREST surface reached with the publishable key; they are not
 * in the path of a single screen. So this file, and not the database, is what
 * stops one team seeing another's bookings in the app.
 *
 * Deliberately free of `import "server-only"` and of any database handle: it
 * imports the schema and `drizzle-orm` and nothing else, so the exact SQL the
 * app will run can be built and asserted in a plain vitest run with no
 * connection and no environment. That is `vidljivost.test.ts`, and it is the
 * only cheap way to prove this predicate is what we think it is.
 *
 * The rule is expressed twice on purpose — here for the app, and again as SQL
 * in `0004` for PostgREST. A single shared Postgres function was tried and
 * discarded: those functions read `auth.uid()`, which is NULL over this
 * connection because there is no JWT on it, so a shared function would filter
 * everything to nothing. Two independent expressions guarding two different
 * doors, reconciled against real data by `npm run provera:vidljivost`.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import { reservations, type Profile } from "./schema";

/**
 * What one signed-in person may see.
 *
 * A closed set of three, rather than a nullable team id, so that "sees
 * everything" is a case a reader has to handle rather than a value that can
 * arrive by accident. `nista` exists so there is somewhere safe to land: a
 * state that should be impossible resolves to *nothing visible* instead of to
 * *everything visible*.
 */
export type Vidljivost =
  | { readonly vrsta: "sve" }
  | { readonly vrsta: "tim"; readonly timId: string }
  | { readonly vrsta: "nista" };

/**
 * The only way a `Vidljivost` is made. Never construct one inline — the `sve`
 * branch is the one place a mistake opens the whole book, so it has exactly
 * one author.
 */
export function vidljivostZa(
  profil: Pick<Profile, "uloga" | "timId">,
): Vidljivost {
  if (profil.uloga === "admin") return { vrsta: "sve" };
  // A korisnik always has a team — migration 0004 has a CHECK that says so.
  // If one ever does not, that is a broken invariant, and a broken invariant
  // must show up as an empty list, never as somebody else's bookings.
  if (profil.timId === null) return { vrsta: "nista" };
  return { vrsta: "tim", timId: profil.timId };
}

/**
 * The `WHERE` fragment. `undefined` means no restriction, which Drizzle reads
 * as "no where clause" — correct, and only ever returned for an admin.
 *
 * Note what `eq(timId, …)` does with an administrators-only booking: its
 * `tim_id` is NULL, and `NULL = '…'` is NULL rather than true, so it does not
 * match. That is the intended behaviour and it falls out of SQL's own null
 * handling rather than being bolted on — but it is the kind of thing that is
 * true by accident until somebody rewrites it, so `vidljivost.test.ts` pins it.
 */
export function uslovVidljivosti(v: Vidljivost): SQL | undefined {
  switch (v.vrsta) {
    case "sve":
      return undefined;
    case "tim":
      return eq(reservations.timId, v.timId);
    case "nista":
      return sql`false`;
  }
}

/** Shorthand for the common case: build the condition straight from a profile. */
export function uslovZa(
  profil: Pick<Profile, "uloga" | "timId">,
): SQL | undefined {
  return uslovVidljivosti(vidljivostZa(profil));
}
