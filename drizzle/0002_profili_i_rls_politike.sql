-- Migration 0002 — the real accounts, profiles.id → auth.users(id), and the
-- RLS policies that open the door drizzle/0001_ukljuci_rls.sql locked.
--
-- drizzle-orm's postgres-js migrator runs every statement in a migration
-- file inside one transaction (see node_modules/drizzle-orm/pg-core's
-- dialect.migrate — one `session.transaction(...)` wraps the whole file), so
-- steps 1–4 below either all land or none do. No explicit BEGIN/COMMIT here:
-- that would try to open a transaction inside the one already open and fail.
--
-- Order matters. Placeholder UUIDs 00000000-0000-4000-8000-000000000001/2
-- are not present in auth.users, so adding the FK in step 4 before the
-- placeholders are gone (steps 1–3) would fail the constraint check.
--------------------------------------------------------------------------

-- Fail loudly, not silently, if the two accounts are somehow missing —
-- an `insert ... select ... from auth.users where id = …` that matches no
-- row would otherwise insert nothing and the problem would only surface
-- later as a foreign key error on the reservations repoint below.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "auth"."users" WHERE "id" = '56231ad7-e99a-4425-ae45-f87a82b2c07d') THEN
		RAISE EXCEPTION 'auth.users nema nalog Mihajlo (56231ad7-e99a-4425-ae45-f87a82b2c07d). Migracija 0002 zaustavljena.';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM "auth"."users" WHERE "id" = '22ecbb36-23fd-4d78-905d-fb8f0d2c89ca') THEN
		RAISE EXCEPTION 'auth.users nema nalog Petar (22ecbb36-23fd-4d78-905d-fb8f0d2c89ca). Migracija 0002 zaustavljena.';
	END IF;
END $$;
--> statement-breakpoint

--------------------------------------------------------------------------
-- Step 1: insert the two real profile rows. Email is copied from
-- auth.users with `insert ... select`, never written as a literal — this
-- file is committed to a public repo and both addresses are the account
-- holders' own personal addresses.
--------------------------------------------------------------------------
INSERT INTO "profiles" ("id", "ime", "email", "boja")
SELECT "id", 'Mihajlo', "email", '#2563eb'
FROM "auth"."users"
WHERE "id" = '56231ad7-e99a-4425-ae45-f87a82b2c07d'
ON CONFLICT ("id") DO UPDATE SET
	"ime" = excluded."ime",
	"email" = excluded."email",
	"boja" = excluded."boja";
--> statement-breakpoint

INSERT INTO "profiles" ("id", "ime", "email", "boja")
SELECT "id", 'Petar', "email", '#d97706'
FROM "auth"."users"
WHERE "id" = '22ecbb36-23fd-4d78-905d-fb8f0d2c89ca'
ON CONFLICT ("id") DO UPDATE SET
	"ime" = excluded."ime",
	"email" = excluded."email",
	"boja" = excluded."boja";
--> statement-breakpoint

--------------------------------------------------------------------------
-- Step 2: re-point reservations.kreirao from each placeholder profile to
-- its real replacement, so the placeholders end up unreferenced.
--------------------------------------------------------------------------
UPDATE "reservations"
SET "kreirao" = '56231ad7-e99a-4425-ae45-f87a82b2c07d'
WHERE "kreirao" = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint

UPDATE "reservations"
SET "kreirao" = '22ecbb36-23fd-4d78-905d-fb8f0d2c89ca'
WHERE "kreirao" = '00000000-0000-4000-8000-000000000002';
--> statement-breakpoint

--------------------------------------------------------------------------
-- Step 3: delete the two placeholder profiles now that nothing references
-- them. `reservations.kreirao` is ON DELETE RESTRICT, so this fails loudly
-- if step 2 missed a row instead of silently orphaning anything.
--------------------------------------------------------------------------
DELETE FROM "profiles" WHERE "id" IN (
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002'
);
--> statement-breakpoint

--------------------------------------------------------------------------
-- Step 4: only now can profiles.id become a real foreign key to
-- auth.users(id) — the placeholder ids were absent from auth.users, so this
-- constraint would have rejected them had it existed before step 3.
--
-- auth.users is owned and managed by Supabase Auth. This migration never
-- creates, alters or drops it — only references its primary key. ON DELETE
-- CASCADE: if an account is ever removed in the dashboard, its badge row
-- should not be left dangling with no matching auth.users row.
--------------------------------------------------------------------------
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

--------------------------------------------------------------------------
-- RLS policies — the keys for the door drizzle/0001_ukljuci_rls.sql already
-- locked (RLS enabled, zero policies, default-deny). Per SPEC §9's
-- access-control row: both accounts see and edit everything, so this is
-- "authenticated or not", never per-user — except profiles.update, which is
-- restricted to your own row. Nothing is granted to `anon`.
--------------------------------------------------------------------------

-- reservations: select / insert / update / delete for any authenticated
-- user. `kreirao` is a badge, never a permission (see agent brief).
CREATE POLICY "authenticated_select_reservations" ON "reservations"
	FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "authenticated_insert_reservations" ON "reservations"
	FOR INSERT TO authenticated WITH CHECK (true);
--> statement-breakpoint

CREATE POLICY "authenticated_update_reservations" ON "reservations"
	FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--> statement-breakpoint

CREATE POLICY "authenticated_delete_reservations" ON "reservations"
	FOR DELETE TO authenticated USING (true);
--> statement-breakpoint

-- profiles: both badges are readable by both accounts; you can only edit
-- your own row (there is no reason for either account to rename or
-- recolour the other's badge).
CREATE POLICY "authenticated_select_profiles" ON "profiles"
	FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "authenticated_update_own_profile" ON "profiles"
	FOR UPDATE TO authenticated USING (auth.uid() = "id") WITH CHECK (auth.uid() = "id");
--> statement-breakpoint

-- destinacije: read-only reference data. No write policy — it is seeded
-- server-side, which connects as `postgres` and bypasses RLS entirely.
CREATE POLICY "authenticated_select_destinacije" ON "destinacije"
	FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- settings: one row (id = 1, enforced by a check constraint), both
-- accounts can read and edit it. No insert/delete policy — the row is
-- written once by the server-side seed, which bypasses RLS.
CREATE POLICY "authenticated_select_settings" ON "settings"
	FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "authenticated_update_settings" ON "settings"
	FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
