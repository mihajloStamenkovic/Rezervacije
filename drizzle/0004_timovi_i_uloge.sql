-- Migration 0004 — teams and roles.
--
-- Until now `profiles` was a flat access list: a row meant "may use the app",
-- and every member could read, edit and delete every reservation. That was
-- right for two partners who own the business together. It is wrong the
-- moment an account is handed to a driver.
--
-- What this establishes:
--
--   * `timovi`            — a team is the unit of visibility.
--   * `profiles.uloga`    — 'admin' (an owner) or 'korisnik' (a driver).
--   * `profiles.tim_id`   — which team a driver belongs to.
--   * `profiles.aktivan`  — soft revocation.
--   * `reservations.tim_id` — which team may SEE this booking. NULL = admins only.
--
-- The rule, mirrored in src/domen/pristup.ts:
--
--   An admin sees every reservation. A korisnik sees the reservations
--   belonging to their own team.
--
-- WHY THE BOOKING CARRIES THE TEAM rather than inheriting its author's: the
-- owners are the dispatchers. They take the calls and enter the bookings the
-- drivers then drive. Derived from the author, every booking an owner entered
-- would be invisible to the driver who had to make the trip — silently,
-- because an absent booking looks exactly like a quiet day. Storing it also
-- freezes history: moving somebody between teams cannot retroactively hand
-- their old customers' names and phone numbers to a different crew.
--
-- This is the tenth column on `reservations`, and standing rule 2 was amended
-- the same day to say what it always meant: the nine columns *describing the
-- trip* are fixed. No status, no note, no timestamps — still true.
--
-- WHY `aktivan` HAS TO EXIST: reservations.kreirao -> profiles.id is
-- ON DELETE RESTRICT and profiles.id -> auth.users.id is ON DELETE CASCADE.
-- Once somebody has entered a booking, deleting them fails from both ends.
-- Flipping `aktivan` to false is the only working way to take access away.
-- RUNBOOK.md said otherwise until today; it was wrong.
--
-- `aktivan` governs SIGNING IN and never visibility. A deactivated driver's
-- bookings stay visible to their team, which is what the team needs after that
-- person stops working. Were it part of the visibility rule, deactivating
-- somebody would silently empty their crew's schedule.
--
-- HAND-WRITTEN, and it has to be. `drizzle-kit generate` produces the right
-- columns in the wrong order: it adds `uloga` with its final default of
-- 'korisnik' and then adds `profiles_tim_prema_ulozi`, which both existing
-- rows violate the instant it is created, because a korisnik must have a team
-- and neither of them has one. The generated file fails on the only database
-- there is. The snapshot in `meta/0004_snapshot.json` is drizzle-kit's and is
-- correct — only the DDL below is ours.
--------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "timovi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"naziv" text NOT NULL,
	CONSTRAINT "timovi_naziv_unique" UNIQUE("naziv")
);
--> statement-breakpoint

ALTER TABLE "timovi" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

COMMENT ON TABLE "timovi" IS
	'Jedinica vidljivosti. Clanovi jednog tima vide rezervacije svog tima.';
--> statement-breakpoint

--------------------------------------------------------------------------
-- profiles — three new columns.
--
-- `uloga` defaults to 'admin' for the length of this migration and no longer.
-- The only two rows that exist are the owners', so they become admins, and
-- the currently deployed code — which shows every member everything — keeps
-- behaving exactly as it does today. That is what makes this migration a
-- behavioural no-op: there is no window in which the app is broken, and none
-- in which it is more permissive than before.
--
-- The default is then dropped to 'korisnik', so that a row created later
-- without an explicit role is a driver rather than an owner. Failing closed is
-- the whole point of a default on this column.
--------------------------------------------------------------------------

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "uloga" text DEFAULT 'admin' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "tim_id" uuid;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "aktivan" boolean DEFAULT true NOT NULL;
--> statement-breakpoint

ALTER TABLE "profiles" ALTER COLUMN "uloga" SET DEFAULT 'korisnik';
--> statement-breakpoint

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tim_id_timovi_id_fk"
	FOREIGN KEY ("tim_id") REFERENCES "public"."timovi"("id")
	ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "profiles_tim_id_idx" ON "profiles" ("tim_id");
--> statement-breakpoint

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_uloga_dozvoljena"
	CHECK ("uloga" IN ('admin', 'korisnik'));
--> statement-breakpoint

-- An admin belongs to no team and sees everything; a driver must belong to
-- exactly one. This constraint is the highest-value line in the migration: it
-- makes "a korisnik with no team" — the state in which the visibility rule has
-- no defensible answer — impossible to store at all.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tim_prema_ulozi"
	CHECK (("uloga" = 'admin' AND "tim_id" IS NULL)
	    OR ("uloga" = 'korisnik' AND "tim_id" IS NOT NULL));
--> statement-breakpoint

--------------------------------------------------------------------------
-- reservations — the tenth column.
--
-- Existing rows get NULL: administrators only. Every booking in the table was
-- entered by an owner, and there are no teams yet for them to belong to, so
-- NULL is both the honest answer and the safe one. The owners reassign them
-- from the app afterwards, or delete them — they are seed fixtures.
--------------------------------------------------------------------------

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "tim_id" uuid;
--> statement-breakpoint

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tim_id_timovi_id_fk"
	FOREIGN KEY ("tim_id") REFERENCES "public"."timovi"("id")
	ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "reservations_tim_id_idx" ON "reservations" ("tim_id");
--> statement-breakpoint

COMMENT ON COLUMN "reservations"."tim_id" IS
	'Tim koji vidi rezervaciju. NULL znaci: vide je samo administratori.';
--> statement-breakpoint

--------------------------------------------------------------------------
-- The rule, as functions.
--
-- SECURITY DEFINER for the reason `je_clan()` already needs it: these are
-- called from policies on `profiles`, and a plain function selecting from
-- `profiles` inside that table's own policy is infinite recursion. Running as
-- the owner takes the inner select out of RLS and breaks the cycle.
--
-- `search_path` is pinned so a caller cannot put their own `profiles` earlier
-- on the path and answer these questions themselves.
--
-- NOTE these are the RLS half only. They read `auth.uid()`, which is NULL over
-- the application's own connection — Drizzle connects as `postgres` with no
-- JWT — so the app cannot and does not call them. The app's equivalent is the
-- WHERE clause built in src/db/vidljivost.ts. Two independent expressions of
-- one rule, guarding two different doors, checked against each other by
-- `npm run provera:vidljivost`.
--------------------------------------------------------------------------

-- Membership now also requires the account to be active. This one line
-- retightens every policy written in 0003, which is the intent.
CREATE OR REPLACE FUNCTION "public"."je_clan"()
	RETURNS boolean
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = public, pg_temp
AS $$
	SELECT EXISTS (
		SELECT 1 FROM "public"."profiles"
		WHERE "id" = (SELECT auth.uid()) AND "aktivan"
	);
$$;
--> statement-breakpoint

COMMENT ON FUNCTION "public"."je_clan"() IS
	'Da li prijavljeni nalog ima aktivan red u profiles.';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."je_admin"()
	RETURNS boolean
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = public, pg_temp
AS $$
	SELECT EXISTS (
		SELECT 1 FROM "public"."profiles"
		WHERE "id" = (SELECT auth.uid()) AND "aktivan" AND "uloga" = 'admin'
	);
$$;
--> statement-breakpoint

COMMENT ON FUNCTION "public"."je_admin"() IS
	'Da li je prijavljeni nalog aktivan administrator.';
--> statement-breakpoint

-- The caller's team, or NULL for an admin or a stranger. Never compare this to
-- another NULL: `moj_tim() = tim_id` is NULL, not true, when both sides are
-- NULL, which is exactly the behaviour the policies below rely on to keep
-- administrators-only bookings away from drivers.
CREATE OR REPLACE FUNCTION "public"."moj_tim"()
	RETURNS uuid
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = public, pg_temp
AS $$
	SELECT "tim_id" FROM "public"."profiles"
	WHERE "id" = (SELECT auth.uid()) AND "aktivan";
$$;
--> statement-breakpoint

COMMENT ON FUNCTION "public"."moj_tim"() IS
	'Tim prijavljenog naloga. NULL za administratora.';
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."je_admin"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."je_admin"() TO "authenticated";
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."moj_tim"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."moj_tim"() TO "authenticated";
--> statement-breakpoint

--------------------------------------------------------------------------
-- timovi — a driver reads only their own team; only admins write.
--------------------------------------------------------------------------

CREATE POLICY "clanovi_select_timovi" ON "timovi"
	FOR SELECT TO authenticated
	USING ("public"."je_admin"() OR "id" = "public"."moj_tim"());
--> statement-breakpoint

CREATE POLICY "admini_insert_timovi" ON "timovi"
	FOR INSERT TO authenticated WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

CREATE POLICY "admini_update_timovi" ON "timovi"
	FOR UPDATE TO authenticated
	USING ("public"."je_admin"()) WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- reservations — the flat member policies from 0003 become the team rule.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "clanovi_select_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "tim_select_reservations" ON "reservations"
	FOR SELECT TO authenticated
	USING ("public"."je_admin"() OR "tim_id" = "public"."moj_tim"());
--> statement-breakpoint

-- A driver may only file a booking under their own team, and only in their own
-- name. An admin may file under any team, or under none.
DROP POLICY IF EXISTS "clanovi_insert_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "tim_insert_reservations" ON "reservations"
	FOR INSERT TO authenticated
	WITH CHECK (
		"public"."je_admin"()
		OR ("public"."je_clan"()
		    AND "kreirao" = (SELECT auth.uid())
		    AND "tim_id" = "public"."moj_tim"())
	);
--> statement-breakpoint

-- Both USING and WITH CHECK, so a booking cannot be edited *out* of the team
-- that can see it — without the WITH CHECK, a driver could set tim_id to
-- another crew's and lose the booking from their own schedule in one tap.
DROP POLICY IF EXISTS "clanovi_update_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "tim_update_reservations" ON "reservations"
	FOR UPDATE TO authenticated
	USING ("public"."je_admin"() OR "tim_id" = "public"."moj_tim"())
	WITH CHECK ("public"."je_admin"() OR "tim_id" = "public"."moj_tim"());
--> statement-breakpoint

DROP POLICY IF EXISTS "clanovi_delete_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "tim_delete_reservations" ON "reservations"
	FOR DELETE TO authenticated
	USING ("public"."je_admin"() OR "tim_id" = "public"."moj_tim"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- profiles — a driver sees their own row and their own active teammates, and
-- nothing else. This is what makes accounts outside the team invisible rather
-- than merely unreadable.
--
-- Only an admin may write. The old `clanovi_update_own_profile` is dropped
-- rather than narrowed: it was never exercised — there is no profile-editing
-- UI — and leaving a self-update policy standing next to columns that decide
-- access is how somebody eventually promotes themselves.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "clanovi_select_profiles" ON "profiles";
--> statement-breakpoint
CREATE POLICY "tim_select_profiles" ON "profiles"
	FOR SELECT TO authenticated USING (
		"public"."je_admin"()
		OR "id" = (SELECT auth.uid())
		OR ("uloga" <> 'admin' AND "tim_id" = "public"."moj_tim"())
	);
--> statement-breakpoint

DROP POLICY IF EXISTS "clanovi_update_own_profile" ON "profiles";
--> statement-breakpoint
CREATE POLICY "admini_update_profiles" ON "profiles"
	FOR UPDATE TO authenticated
	USING ("public"."je_admin"()) WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

CREATE POLICY "admini_insert_profiles" ON "profiles"
	FOR INSERT TO authenticated WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- settings — one shared row, so a driver changing the default home town would
-- change it for every other crew. Reading stays open to members; writing
-- becomes an admin's job.
--
-- The INSERT policy also closes a gap recorded in build_plan.md: 0003 granted
-- select and update only, while `postaviPodrazumevanuDestinaciju` is an
-- insert ... on conflict do update. It never failed because that path runs
-- through Drizzle as the table owner, but the policy set did not describe the
-- write the app actually performs.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "clanovi_update_settings" ON "settings";
--> statement-breakpoint
CREATE POLICY "admini_update_settings" ON "settings"
	FOR UPDATE TO authenticated
	USING ("public"."je_admin"()) WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

CREATE POLICY "admini_insert_settings" ON "settings"
	FOR INSERT TO authenticated WITH CHECK ("public"."je_admin"());
--> statement-breakpoint

COMMENT ON COLUMN "profiles"."uloga" IS 'admin ili korisnik.';
--> statement-breakpoint
COMMENT ON COLUMN "profiles"."tim_id" IS 'Tim vozaca. NULL samo za administratore.';
--> statement-breakpoint
COMMENT ON COLUMN "profiles"."aktivan" IS 'false zakljucava nalog pri sledecem zahtevu.';
