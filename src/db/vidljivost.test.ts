/**
 * Asserts the SQL the app will actually run.
 *
 * `src/db/queries.ts` cannot be imported here — it starts with
 * `import "server-only"`, which throws outside a React Server environment, and
 * aliasing that away in `vitest.config.mts` would disable the guard for every
 * test in the project forever. So the predicate lives in its own module and
 * this file rebuilds the query around it with Drizzle's database-less
 * `QueryBuilder`.
 *
 * The `casing: "snake_case"` below is not decoration: it must match
 * `src/db/index.ts`, or this file asserts SQL that production never emits —
 * the one way this test passes while the app is broken.
 */
import { describe, expect, it } from "vitest";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm";
import { reservations } from "./schema";
import { uslovVidljivosti, uslovZa, vidljivostZa } from "./vidljivost";

const TIM_A = "00000000-0000-4000-8000-300000000001";

const ADMIN = { uloga: "admin", timId: null } as const;
const VOZAC = { uloga: "korisnik", timId: TIM_A } as const;

const qb = new QueryBuilder({ casing: "snake_case" });

const upit = (profil: { uloga: string; timId: string | null }) =>
  qb.select().from(reservations).where(uslovZa(profil)).toSQL();

describe("vidljivostZa — the only place a Vidljivost is made", () => {
  it("an admin sees everything", () => {
    expect(vidljivostZa(ADMIN)).toEqual({ vrsta: "sve" });
  });

  it("a driver sees their own team", () => {
    expect(vidljivostZa(VOZAC)).toEqual({ vrsta: "tim", timId: TIM_A });
  });

  it("a driver with no team sees NOTHING, not everything", () => {
    // The CHECK constraint in 0004 makes this state unstorable. If it ever
    // occurs anyway, it must fail closed — this is the single assertion that
    // separates a broken invariant from a data breach.
    expect(vidljivostZa({ uloga: "korisnik", timId: null })).toEqual({
      vrsta: "nista",
    });
  });
});

describe("the generated WHERE clause", () => {
  it("an admin's query carries no restriction at all", () => {
    const { sql: s, params } = upit(ADMIN);
    expect(s).not.toContain("where");
    expect(params).toEqual([]);
  });

  it("a driver's query filters on tim_id, with the id as a bound parameter", () => {
    const { sql: s, params } = upit(VOZAC);
    expect(s).toContain('"reservations"."tim_id" = $1');
    // Bound, not interpolated: this is what makes the assertion meaningful and
    // what keeps an id out of the SQL text.
    expect(params).toEqual([TIM_A]);
  });

  it("an impossible profile produces a query that returns no rows", () => {
    const { sql: s } = upit({ uloga: "korisnik", timId: null });
    expect(s).toContain("false");
  });

  it("administrators-only bookings cannot match a team filter", () => {
    // `tim_id = $1` against a NULL tim_id evaluates to NULL, not true, so an
    // admin-only booking never matches. That is SQL's own null handling doing
    // the right thing — pinned here because it is exactly the kind of
    // correctness that survives until somebody "simplifies" the predicate.
    const uslov = uslovVidljivosti({ vrsta: "tim", timId: TIM_A });
    expect(uslov).toBeDefined();
    const { sql: s } = qb.select().from(reservations).where(uslov).toSQL();
    expect(s).not.toContain("is null");
    expect(s).not.toContain("coalesce");
  });

  it("composes with another condition without losing itself", () => {
    // How the detail screen and the delete action use it: id AND visibility,
    // in one statement, so "not yours" and "not found" are the same answer and
    // there is no gap between checking and acting.
    const { sql: s, params } = qb
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, "r1"), uslovZa(VOZAC)))
      .toSQL();
    expect(s).toContain('"reservations"."id" = $1');
    expect(s).toContain('"reservations"."tim_id" = $2');
    expect(params).toEqual(["r1", TIM_A]);
  });

  it("an admin composing with a condition still gets that condition", () => {
    // `and(x, undefined)` must not collapse to "no filter at all".
    const { sql: s, params } = qb
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, "r1"), uslovZa(ADMIN)))
      .toSQL();
    expect(s).toContain('"reservations"."id" = $1');
    expect(params).toEqual(["r1"]);
  });
});
