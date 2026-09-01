# RUNBOOK — Kombi Rezervacije

What to do when something breaks. Written to be followed under pressure, by
someone who did not write the app.

---

## 1. Rezerve (backups)

### How it works, exactly

A GitHub Action, [`.github/workflows/rezerva.yml`](./.github/workflows/rezerva.yml),
runs **every night at 01:30 UTC** — 02:30 in Belgrade in winter, 03:30 in
summer. Each run does four things:

1. **Installs `pg_dump` 17 and calls it by absolute path.** The Supabase server
   is Postgres 17.6 and `pg_dump` refuses to dump from a server newer than
   itself. GitHub's runner ships client 16, so 17 is installed on every run —
   and then invoked as `/usr/lib/postgresql/17/bin/pg_dump`, because plain
   `pg_dump` is a wrapper that keeps resolving to the pre-installed 16. The
   step asserts it really got 17 before any dump is attempted.
2. **Dumps the `public` schema** over the session pooler (port 5432) — all
   four tables, their data, the RLS policies and the `je_clan()` function.
   The `auth` schema is **not** dumped: it is Supabase's own and holds
   password hashes, so a backup can never leak credentials.
3. **Writes a CSV** of every reservation with the destination and author names
   resolved — a copy a human can read with no tools at all.
4. **Commits both** to the orphan branch `rezerve`.

```
rezerve (branch)
├── dump/2026/2026-09-01.sql.gz     ← full restore, one per night
├── csv/2026-09-01-rezervacije.csv  ← readable snapshot, one per night
└── csv/rezervacije-najnovije.csv   ← always the latest; GitHub shows it as a table
```

`rezerve` is an **orphan branch** — it shares no history with `main`, so
cloning the code never drags backups along, and the backups never expire the
way build artifacts do. A nightly dump is ~3 KB gzipped, so a year costs about
a megabyte. Nothing is ever pruned.

### It is also what keeps the app online

Supabase pauses a free project after **7 days without activity**. A quiet week
in winter would take the app offline until somebody noticed. The nightly dump
is a daily query, so the project never goes idle. This is why the job must not
be switched off during the off-season — that is exactly when it matters most.

### It refuses to save a bad backup

A backup that silently contains nothing is worse than none, because it looks
like success. Before committing, the job checks the dump has all four
`CREATE TABLE` statements, at least one destination block, and is over 2 KB.
If any check fails the run goes **red** and nothing is committed.

**A red run means you have no new backup.** Open it and read the log.

### Setup — one thing you must do

The workflow needs one secret. In GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `DIRECT_URL` | the same `DIRECT_URL` line from `.env.local` — the pooler on port **5432**, not 6543 |

Then run it once by hand to confirm: **Actions → Nocna rezerva → Run workflow**.

---

## 2. Restoring

### Getting a backup

```bash
git fetch origin rezerve
git checkout rezerve
gunzip -k dump/2026/2026-09-01.sql.gz     # pick the night you want
```

Or just read `csv/rezervacije-najnovije.csv` on github.com — it renders as a
table, and for "what was that phone number" that is usually enough.

### Restoring one deleted reservation

Almost always what you actually want. Do **not** restore the whole database to
recover one row — that would throw away every booking made since.

Open the CSV for the night before the deletion, find the row, and type it back
into the app through **Nova rezervacija**. Four fields and two dates. This is
the normal recovery path.

### Restoring everything

Only after real data loss. The dump contains no `DROP` statements, so it must
go into an **empty** database — it will not overwrite a live one.

```bash
# Into a scratch database first. Never straight at production.
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -f dump/2026/2026-09-01.sql
psql "$SCRATCH_URL" -c "SELECT count(*) FROM reservations;"
```

Check the count matches what you expect **before** going near the real one.

### Verifying a backup without touching anything

This is worth doing occasionally, and it is completely safe — it restores into
a temporary schema inside a transaction and then rolls back, so nothing
persists:

```bash
gunzip -c dump/2026/2026-09-01.sql.gz | sed 's/"public"/"rezerva_proba"/g' > /tmp/proba.sql
{ echo "BEGIN;"; cat /tmp/proba.sql; \
  echo 'SELECT count(*) FROM "rezerva_proba"."reservations";'; \
  echo "ROLLBACK;"; } | psql "$DIRECT_URL" -v ON_ERROR_STOP=1
```

Verified this way on 01.09.2026: 44 destinacije, 2 profila, 8 rezervacija,
1 settings row, restored and rolled back cleanly.

---

## 3. Who can log in

**`profiles` is the access list.** A person can use the app only if they have a
row there. This is enforced in the database (migration `0003` — every RLS
policy tests `je_clan()`), in the login action, and in `src/proxy.ts`.

Signups are also switched off in the Supabase dashboard.

### Adding a person

Two steps, and skipping the second locks them out rather than letting them in:

1. Supabase dashboard → **Authentication → Users → Add user**. Set their
   password there. Nobody else ever handles it.
2. Insert their row into `profiles` — `id` (the user id from step 1), `ime`,
   `email`, `boja` (badge colour, e.g. `#2563eb`).

### Removing a person

Delete their `profiles` row. They are locked out on their next request, with
their password unchanged and their bookings untouched.

Do **not** delete them from `auth.users` while they have reservations —
`reservations.kreirao` is `ON DELETE RESTRICT`, so it will fail. That is the
safe direction: no silent data loss.

---

## 4. Destinations

Reference data, seeded from [`data/destinacije.json`](./data/destinacije.json).
There is no admin screen in v1.

To add or change one: edit the JSON, then

```bash
npm run db:seed:destinacije
```

The seed is **idempotent** and keyed on `drzava_sifra` + `regija` + `grad`. It
inserts new rows, updates changed names, flips `aktivna` — and **never
deletes**. A destination a past booking points at always keeps resolving.

To retire a destination, set `"aktivna": false`. It disappears from the
new-booking dropdowns but still renders on existing bookings and stays in the
filter for as long as anything references it.

---

## 5. If the app is down

1. **Is the Supabase project paused?** Dashboard will say so. Unpause it, then
   check why the nightly job stopped running — that is what should have
   prevented it.
2. **Is the nightly backup red?** Actions tab. Open the failed step; it prints
   `--- pg_dump ---`, `--- csv ---` and `--- provera ---` markers so the log
   says which stage broke.
   - `DIRECT_URL` rotated → the secret is stale. Update it in
     **Settings → Secrets and variables → Actions**.
   - `server version mismatch`, or `Ocekivan pg_dump 17, dobijen …` →
     **Supabase upgraded Postgres.** Change `postgresql-client-17`, the
     `PGBIN=/usr/lib/postgresql/17/bin` line and the `"17"` check in
     `.github/workflows/rezerva.yml` to the new major version. Three numbers,
     one file.
   - `Rezerva izgleda prazna ili nepotpuna` → the dump came back short and was
     deliberately **not** saved. The previous night's backup is still intact.
3. **Login redirect loop?** Almost always a missing `profiles` row for an
   account that exists in `auth.users`. See §3.
