-- Migration 0003 — `profiles` becomes the access list.
--
-- Until now the RLS policies from 0002 read `TO authenticated USING (true)`:
-- *any* row in auth.users could read, update and delete every reservation.
-- That was true whether or not the account had a profile, which made
-- `profiles` a display table — badges and colours — rather than a list of who
-- may enter. This migration makes membership the rule everywhere.
--
-- Signups were switched off in the dashboard on 01.09.2026, which closes the
-- door. This closes it again one layer down, where a dashboard toggle cannot
-- be flipped back by accident: from here on, an auth.users row with no
-- matching profile reads nothing and writes nothing.
--
-- Passwords are deliberately NOT stored here — see the note at the bottom.
--------------------------------------------------------------------------

-- Membership, as one function so the rule is written once and every policy
-- refers to the same thing.
--
-- SECURITY DEFINER is load-bearing, not incidental. The policy on `profiles`
-- itself calls this function, and a plain function selecting from `profiles`
-- inside that table's own policy is infinite recursion — Postgres raises
-- `infinite recursion detected in policy for relation "profiles"`. Running as
-- the owner means the inner select is not itself subject to RLS, which breaks
-- the cycle.
--
-- `search_path` is pinned for the usual SECURITY DEFINER reason: without it a
-- caller could put their own `profiles` table earlier on the path and answer
-- this question themselves.
CREATE OR REPLACE FUNCTION "public"."je_clan"()
	RETURNS boolean
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = public, pg_temp
AS $$
	SELECT EXISTS (
		SELECT 1 FROM "public"."profiles" WHERE "id" = (SELECT auth.uid())
	);
$$;
--> statement-breakpoint

COMMENT ON FUNCTION "public"."je_clan"() IS
	'Da li prijavljeni nalog ima red u profiles. Jedina definicija pristupa aplikaciji.';
--> statement-breakpoint

-- Nothing but a logged-in session has any business asking.
REVOKE ALL ON FUNCTION "public"."je_clan"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."je_clan"() TO "authenticated";
--> statement-breakpoint

--------------------------------------------------------------------------
-- reservations — read and write for members only. `kreirao` stays a badge
-- and never a permission: both accounts may edit and delete each other's
-- bookings, which is the whole point of a shared book.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_select_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "clanovi_select_reservations" ON "reservations"
	FOR SELECT TO authenticated USING ("public"."je_clan"());
--> statement-breakpoint

DROP POLICY IF EXISTS "authenticated_insert_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "clanovi_insert_reservations" ON "reservations"
	FOR INSERT TO authenticated WITH CHECK ("public"."je_clan"());
--> statement-breakpoint

DROP POLICY IF EXISTS "authenticated_update_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "clanovi_update_reservations" ON "reservations"
	FOR UPDATE TO authenticated
	USING ("public"."je_clan"()) WITH CHECK ("public"."je_clan"());
--> statement-breakpoint

DROP POLICY IF EXISTS "authenticated_delete_reservations" ON "reservations";
--> statement-breakpoint
CREATE POLICY "clanovi_delete_reservations" ON "reservations"
	FOR DELETE TO authenticated USING ("public"."je_clan"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- profiles — members see the whole list (both badges), and may edit only
-- their own row. A non-member sees nothing, including their own row: not
-- being on the list is exactly what the app needs to be able to detect.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_select_profiles" ON "profiles";
--> statement-breakpoint
CREATE POLICY "clanovi_select_profiles" ON "profiles"
	FOR SELECT TO authenticated USING ("public"."je_clan"());
--> statement-breakpoint

-- Unchanged in effect — only a member has a row to match — but renamed so
-- every policy on the table reads from the same vocabulary.
DROP POLICY IF EXISTS "authenticated_update_own_profile" ON "profiles";
--> statement-breakpoint
CREATE POLICY "clanovi_update_own_profile" ON "profiles"
	FOR UPDATE TO authenticated
	USING ((SELECT auth.uid()) = "id")
	WITH CHECK ((SELECT auth.uid()) = "id");
--> statement-breakpoint

--------------------------------------------------------------------------
-- destinacije — reference data, still read-only. Seeding runs server-side
-- as `postgres`, which owns the table and bypasses RLS entirely.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_select_destinacije" ON "destinacije";
--> statement-breakpoint
CREATE POLICY "clanovi_select_destinacije" ON "destinacije"
	FOR SELECT TO authenticated USING ("public"."je_clan"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- settings — one row, readable and editable by members.
--------------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_select_settings" ON "settings";
--> statement-breakpoint
CREATE POLICY "clanovi_select_settings" ON "settings"
	FOR SELECT TO authenticated USING ("public"."je_clan"());
--> statement-breakpoint

DROP POLICY IF EXISTS "authenticated_update_settings" ON "settings";
--> statement-breakpoint
CREATE POLICY "clanovi_update_settings" ON "settings"
	FOR UPDATE TO authenticated
	USING ("public"."je_clan"()) WITH CHECK ("public"."je_clan"());
--> statement-breakpoint

--------------------------------------------------------------------------
-- Why there is still no password column on `profiles`.
--
-- SPEC §4 lists `password_hash`, and it was already dropped in Phase 1 when
-- §9 chose Supabase Auth. That decision holds here and is worth restating,
-- because "profiles is the list of users with email and password" is the
-- natural way to describe what this migration does.
--
-- Credentials live in auth.users, which hashes with bcrypt, salts per row,
-- rate-limits sign-in attempts, and is the only thing that ever sees a plain
-- password. A `password_hash` column in `public` would be a second source of
-- truth that can disagree with the first, sitting in the same table the app
-- selects from on every page load, in a schema reachable over PostgREST.
-- There is no version of that which is safer than what Supabase already does.
--
-- What this migration gives instead is the property actually being asked
-- for: **`profiles` is the list of who may enter.** An account exists in
-- auth.users but not in profiles → it reads nothing and writes nothing.
-- Delete a profile row and that person is locked out on their next request,
-- password or no password.
--------------------------------------------------------------------------
