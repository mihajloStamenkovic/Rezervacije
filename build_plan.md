# Build Plan — Kombi Rezervacije

Execution plan for building the app described in [`SPEC.md`](./SPEC.md), using the
agents in `.claude/agents/`.

Read `SPEC.md` first. It is the source of truth; this file is only the order of
operations.

## Status — 01.09.2026

| Phase | State |
|---|---|
| 0 · Scaffold | done |
| 1 · Data layer | done |
| 2 · Locale primitives | done |
| 3 · Domain core | done |
| 4 · Auth and RLS | done |
| 5 · Screens | done |
| 6 · Installable and offline | **next** |
| 7 · Verification gate | not started |
| 8 · Deploy | backups **green and restore-verified**; Vercel, CI and Sentry remain |
| 9 · Handover | not started |

**There is one database and it is the real one.** Development and production are
the same hosted Supabase project, `biqiztxeiqmrgmngemhf`, in the EU
(`eu-central-1`, Frankfurt). `.env.local` points at it, the migrations are applied
and both seeds have run. There is no Docker and no local Supabase stack — the
`supabase/` directory has been removed and the CLI is not part of this workflow.

That means the Supabase half of Phase 8 landed early, out of order. Phase 8 is now
only Vercel, CI, monitoring and backups.

It also means every command runs against live data. `npm run db:reset` is gated
behind `POTVRDA="OBRISI SVE"` and nothing else drops anything.

**Verified at the end of Phase 5:** `npm run typecheck` clean · `npm run lint`
clean · `npm run test` 222/222 · `npm run build` succeeds (7 routes + Proxy) ·
`npm run test:tz` — **222 tests across 5 timezones, all identical**. All five
screens redirect to `/prijava` when logged out. RLS verified by curl in Phase 4:
the publishable key with no session returns `[]` from all four tables.

**Phase 5 is signed off.** The mobile gates were closed by hand in Chrome at a
375px viewport, signed in, against the real database: no horizontal scroll on
any route, no touch target under 44px, no input under 16px, and the cascade,
the ⇅ swap, the filter rollup, Dan mode and the delete guard all driven
individually. Nothing was written — counts before and after were identical.

**`profiles` is the access list — 01.09.2026.** Signups were switched off in the
dashboard, and migration `0003` made membership the rule in the database rather
than a convention: every policy now tests `je_clan()` instead of `USING (true)`.
An `auth.users` row with no `profiles` row reads nothing and writes nothing.
Proven by role impersonation in a rolled-back transaction — a member sees 8
reservations and could delete 8; a stranger with a valid session sees **0** and
deletes **0**. Adding a person is now two steps, and skipping the second fails
closed: create the account in the dashboard, then insert their `profiles` row.

**Verified on the hosted project:** migrations `0000` and `0001` applied · 44
destinacije, 2 profila, 8 rezervacija, 1 settings row · RLS enabled on all four
tables with zero policies, so the publishable key returns `[]` from every table
while server-side queries are unaffected.

## Agents

| Agent | Owns | Model |
|---|---|---|
| `supabase` | Schema, Drizzle models, migrations, seeds, query layer | sonnet |
| `locale` | Serbian strings, date formatting, collation, phone normalization | sonnet |
| `domain-logic` | Main leg rule, list modes, filter + sort semantics | opus |
| `security` | Supabase Auth, sessions, middleware, **RLS policies**, secrets | sonnet |
| `ui` | All screens, Tailwind, shadcn, mobile-first — **and** PWA, offline, install | sonnet |
| `developer` | Routes, Server Actions, Zod, wiring — **and** Vercel, CI, backups | sonnet |
| `tester` | Spec conformance, edge cases, timezone, mobile, evidence | opus |

Code quality review is handled by the built-in `/code-review` skill, not a custom
agent — no need to duplicate it.

---

## Dependency graph

```
Phase 0  Scaffold                        (main session)
            │
      ┌─────┴─────┐
      ▼           ▼
Phase 1        Phase 2                   ← these two run in parallel
supabase       locale
      │           │
      └─────┬─────┘
            ▼
Phase 3  domain-logic                     ← needs schema + Belgrade "today"
            │
            ▼
Phase 4  security                         ← needs profiles table
            │
            ▼
Phase 5  ui — screens                     ← needs logic, strings, session
            │
            ▼
Phase 6  ui — installable and offline     ← needs a working app to cache
            │
            ▼
Phase 7  tester                           ← verification gate
            │
            ▼
Phase 8  developer — deploy
            │
            ▼
Phase 9  Device smoke test + handover     (main session)
```

---

## Phase 0 — Scaffold ✅

**Agent:** none — main session. **Completed 28.08.2026.**

- `create-next-app`: TypeScript strict, App Router, Tailwind v4, ESLint
- `git remote add origin https://github.com/mihajloStamenkovic/Rezervacije.git`
- Install: `drizzle-orm`, `drizzle-kit`, `postgres`, `zod`,
  `@supabase/supabase-js`, `@supabase/ssr`, `date-fns`, `libphonenumber-js`,
  `@serwist/next`
- `npx shadcn@latest init`, then add **only** `sheet dialog input button checkbox`
- Hosted Supabase project, EU (Frankfurt). Connection strings and API keys into
  `.env.local`
- `.env.example` committed; `.env.local` git-ignored
- `data/destinacije.json` is already in the repo — the destination reference data
  captured from eurotravel.rs on 27.08.2026

**Done when:** `npm run dev` serves a blank page and `tsc --noEmit` is clean.

> Pin versions at install time. Check what is current — do not trust version
> numbers quoted from memory.

### What was built

Versions were resolved from the registry at install time and pinned exactly:
Next **16.3.3**, React **19.2.8**, Tailwind **v4**, drizzle-orm **0.45.2**,
drizzle-kit **0.31.10**, postgres **3.4.9**, zod **4.4.3**,
`@supabase/supabase-js` **2.112.4**, `@supabase/ssr` **0.12.5**, date-fns
**4.4.0**, libphonenumber-js **1.13.12**, `@serwist/next` **9.5.12**, vitest
**4.1.11**, tsx **4.23.12**.

- `create-next-app` had to run in a temp directory and be moved in: npm rejects
  the project name `Rezervacije` because of the capital letters. `package.json`
  is named `kombi-rezervacije`.
- shadcn 4.x asks for a *base* and a *preset* now. Initialised with
  `--base radix --preset nova`, then added exactly `sheet dialog input checkbox`
  (`button` came with init). Nothing else.
- npm 11 gates postinstall scripts. `esbuild` and `unrs-resolver` were approved
  explicitly and are recorded in `package.json` under `allowScripts`; without
  that, vitest, tsx and drizzle-kit are all broken.
- Next 16 generates route types (`LayoutProps<"/">`) into `.next/types`, so
  `tsc --noEmit` fails on a clean checkout until `next typegen` has run. The
  `typecheck` script runs both — this matters for the Phase 8 CI job.
- `turbopack.root` is pinned in `next.config.ts`: a stray `package-lock.json` in
  the user's home directory otherwise makes Turbopack guess the workspace root
  and warn on every start.
- `git init` plus `origin` → `github.com/mihajloStamenkovic/Rezervacije`.
  No commits made.

**Evidence:** `npm run dev` → `Ready in 1120ms`, `GET / 200`. `npm run build` →
compiled, 2 static routes. `tsc --noEmit` → exit 0.

### How the hosted project got wired up

Phases 0–2 were originally built against a local Supabase stack in Docker. That
was dropped: the stack is one more thing to keep running, it cannot be reached
from a phone, and it gave a false sense of testing auth and RLS locally.

Moving to the hosted project turned up three real problems, all now fixed:

- `NEXT_PUBLIC_SUPABASE_URL` had `/rest/v1/` appended to it. `supabase-js` adds
  that itself, so every client call would have 404'd on a doubled path.
- `DIRECT_URL` pointed at `db.<ref>.supabase.co`, which does not resolve — newer
  projects do not publish that host on IPv4. Migrations and seeds both failed with
  `ENOTFOUND`. It now uses the **session pooler** on port 5432, which is the
  supported replacement and holds the session state DDL needs.
- `npm run db:reset` ran `supabase db reset`, a local-stack-only command. It is
  now `src/db/reset.ts`, which drops this app's four tables and the `drizzle`
  schema — not `drop schema public cascade`, which would take Supabase's role
  grants and extensions with it.

---

## Phase 1 — Data layer ✅

**Agent:** `supabase` · **Parallel with Phase 2** · **Completed 28.08.2026.**

Prompt it with: *"Read SPEC.md §4. Build the Drizzle schema, migrations and seed
for Kombi Rezervacije."*

**Deliverables**
- `src/db/schema.ts` — `reservations` (9 columns), `profiles`, `destinacije`, `settings`
- Generated migration in `drizzle/`
- `src/db/seed-destinacije.ts` — **idempotent**, reads `data/destinacije.json`,
  keyed on `drzava_sifra` + `regija` + `grad`. Inserts, updates, flips `aktivna`.
  **Never deletes.**
- `src/db/seed.ts` — test reservations covering the awkward cases
- Query layer exposing raw rows — no business logic

**Done when**
- Migration applies cleanly
- Dates are `date` columns in `{ mode: 'string' }` — **not** `timestamp`
- Destination seed produces **44 cities across 17 regions in 7 countries**, and
  running it twice changes nothing the second time
- Slovenija and BiH land with `aktivna = false`
- `Srbija › Beograd › Beograd` is present (added manually — not on the client's site)
- Reservation seed includes: departed-with-no-return, Greece→Belgrade one-way,
  same-day round trip, departing-today
- `kreirao` and both destination FKs are `ON DELETE RESTRICT`

### What was built

| File | Purpose |
|---|---|
| `src/db/schema.ts` | `reservations` (9 columns), `profiles`, `destinacije`, `settings` |
| `drizzle.config.ts` | `snake_case` casing, migrations out to `drizzle/`, uses `DIRECT_URL` |
| `drizzle/0000_pocetna_sema.sql` | the generated migration |
| `drizzle/0001_ukljuci_rls.sql` | RLS enabled on all four tables |
| `src/db/migrate.ts` | applies migrations over the direct connection |
| `src/db/reset.ts` | gated destructive reset |
| `src/db/destinacije-json.ts` | flattens the three-level JSON into one row per city |
| `src/db/seed-destinacije.ts` | idempotent destination seed |
| `src/db/seed.ts` | dev fixtures — 2 profiles, settings row, 8 reservations |
| `src/db/index.ts` | pooled Drizzle handle, `server-only`, dev-reload safe |
| `src/db/queries.ts` | raw-row query layer |
| `src/env.ts` | env access that throws on a missing variable |

Scripts: `db:generate`, `db:migrate`, `db:seed:destinacije`, `db:seed`,
`db:reset` (gated reset → migrate → seed both), `db:studio`.

### Evidence

- **Nine columns, `date` not `timestamp`.** `information_schema.columns` for
  `reservations` returns exactly 9 rows; `datum_polaska` and `datum_povratka`
  are both `date`. The schema declares them `{ mode: 'string' }`, so they arrive
  as `YYYY-MM-DD` and never become a JS `Date`.
- **Destination counts.** 44 cities · 17 regions · 7 countries — matches SPEC
  §5. Per country: Grčka 17, Hrvatska 13, Slovenija 7, Srbija 2, Makedonija 2,
  BiH 2, Italija 1.
- **Idempotent.** First run `44 ubačeno`. Second run
  `0 ubačeno, 0 izmenjeno, 44 nepromenjeno` — the second run writes nothing.
- **Update path.** Deactivated Grčka and misspelled it to `Grcka` directly in
  the database, then re-ran: `17 izmenjeno, 27 nepromenjeno`, and both the name
  and `aktivna` were restored.
- **Never deletes.** Inserted a `Crna Gora › Budva › Budva` row that the JSON
  does not contain, then re-ran the seed. It reported
  `1 red(ova) … Nisu obrisani: crnagora|Budva|Budva` and left the row in place.
- **Slovenija and BiH** land `aktivna = false`; `Srbija › Beograd › Beograd` is
  present and active.
- **`ON DELETE RESTRICT`.** All four FKs report `RESTRICT` in
  `information_schema.referential_constraints`. Deleting the Hanioti destination
  and deleting the profile `Nikola` both fail with a foreign key violation.
- **Check constraints** (added beyond the spec — cheap and load-bearing):
  `broj_putnika > 0`, `datum_povratka >= datum_polaska`, and `settings.id = 1`
  so "one settings row" is a database guarantee rather than a convention. All
  three were verified to reject a bad insert.
- **RLS on, default-deny.** `pg_tables` reports `rowsecurity = true` for all four
  tables and `pg_policies` is empty. Curling each table with only the publishable
  key returns `[]`. `npm run db:seed:destinacije` still reports
  `44 nepromenjeno`, proving the server path is unaffected — it connects as
  `postgres`, which owns the tables and so bypasses RLS.

### The eight seed reservations

Dates are relative to today in Belgrade, so the fixtures keep meaning the same
thing next month.

| # | Case it covers |
|---|---|
| 1 | The SPEC §1 worked example — Hanioti, 4 putnika, return in two weeks |
| 2 | **Departing today** — proves the `>=` boundary resolves to ↑ Odlazak |
| 3 | **Departed, return ahead** — must flip to ↓ Povratak and leave the Grčka filter |
| 4 | **Departed, no return date** — has no main date, drops off the list |
| 5 | **Greece → Belgrade one-way** — Beograd in the *outbound* column |
| 6 | **Same-day round trip** — appears in both groups; also `21 putnik` |
| 7 | References an **inactive** destination (Ljubljana) — must still render |
| 8 | Same main date as #6 — exercises the destination-then-name tiebreak |

### Two decisions to flag

**`profiles` has no `password_hash`.** SPEC §4 lists one, but §9 chose Supabase
Auth, which owns credentials in `auth.users`. A password column in `public`
would be a second source of truth and a liability. Reporting rather than
resolving silently, per standing rule 1.

**`profiles.id` has no foreign key to `auth.users` yet.** It is a bare
`uuid primary key`. Wiring it to `auth.users(id)` belongs with the auth work in
Phase 4, which also needs to replace the two placeholder profile UUIDs in
`seed.ts` with the real ones from the dashboard.

---

## Phase 2 — Locale and formatting primitives ✅

**Agent:** `locale` · **Parallel with Phase 1** · **Completed 28.08.2026.**

Prompt it with: *"Read SPEC.md §7. Build the date, phone and string modules."*

**Deliverables**
- `src/lib/datum.ts` — `danasBeograd()`, formatters, day headings
- `src/lib/telefon.ts` — normalize to E.164, display, `tel:` and `wa.me` links
- `src/lib/tekst.ts` — every user-facing string, one file
- One exported `sr-Latn` collation comparator

**Done when**
- `danasBeograd()` returns the same value regardless of process `TZ`
- Passenger pluralization is correct at 1, 2, 4, 5, 21
- No date formatting anywhere constructs a JS `Date` from a `YYYY-MM-DD` string

### What was built

`src/lib/datum.ts` — `danasBeograd()`, plus `pomeriDane`, `razlikaUDanima`,
`danUNedelji`, `pocetakNedelje` / `krajNedelje`, `pocetakMeseca` / `krajMeseca`
(the Phase 3 date-chip ranges), `formatDatum` (`01.01.2026.`), `formatDanMesec`
(`12.09.`), `formatDug` (`1. januar 2026.`), `imeDana`, `naslovDana` (`danas` ·
`sutra` · `juče` · `subota, 12.09.`), `zaInput`, and `jeDatum` as a type guard.

`src/lib/telefon.ts` — `normalizujTelefon` (E.164, default country RS, returns
`null` rather than throwing so it drops straight into a Zod refinement),
`jeIspravanTelefon`, `formatTelefon`, `telLink`, `whatsAppLink`.

`src/lib/tekst.ts` — the `T` object holding every user-facing string, the
three-form Serbian pluraliser (`putnika`, `rezervacija`, `filtera`), and the
single `uporediTekst` collator.

`scripts/test-tz.mjs` plus `npm run test:tz` — runs the whole suite once per
timezone in its own process, because Node reads `TZ` only at startup.

### Evidence

**85 tests, all green, identical under UTC · Europe/Belgrade · Europe/Athens ·
Pacific/Auckland · America/Los_Angeles.**

- **`danasBeograd()` ignores the process timezone.** Measured directly: at the
  instant `2026-01-01T22:45:00Z`, Node's own local hour reads 22 / 11 / 0 / 14 /
  7 across those five zones, while `danasBeograd()` returns `2026-01-01` in all
  five. The naive `new Date("2026-01-01")` comparison drifts to `2025-12-31`
  under `America/Los_Angeles` — that is the bug being designed out.
- Belgrade's own rollover is covered both ways: `22:30Z` on 31.12. is still the
  31st; `23:30Z` is already the 1st. Summer time (CEST, +2) tested separately.
- **No JS `Date` is built from a date string anywhere.** Every formatter splits
  the string and formats the parts; arithmetic goes through `Date.UTC`.
  Spring-forward (29.03.2026) and fall-back (25.10.2026) both step correctly.
- **Pluralisation** at the five values this plan names: `1 putnik`, `2 putnika`,
  `4 putnika`, `5 putnika`, **`21 putnik`** — plus the 11–14 exception
  (`11 putnika`, `111 putnika`) and `101 putnik`.
- **Collation** is `sr-Latn`, not `sr` and not the default: `Cetinje · Čačak ·
  Ćuprija · Drvar · Đakovo · Sarti · Šabac · Zagreb · Žabalj`. Plain `sr` is the
  Cyrillic order and puts `Čačak` before `Cetinje`, which is wrong for Latin
  text.
- A test asserts **no Cyrillic character appears anywhere in `T`**, keys
  included. It has already caught one bug: the key `uneo` had been typed with
  Cyrillic `е` and `о`.

### Note

`formatTelefon("+381641234567")` renders `+381 64 1234567`, not
`+381 64 123 4567` — that is libphonenumber's grouping for Serbian mobiles.
Left as the library has it rather than hand-rolling a different one.

---

## Phase 3 — Domain core ✅

**Agent:** `domain-logic` · **Completed 28.08.2026.**

Prompt it with: *"Read SPEC.md §1, §2, §3, §5. Implement and test the main leg
rule and both list modes."*

**Deliverables**
- `resolveMainLeg(reservation, today)`
- `rasporedView(...)` — one row per reservation, main leg only
- `danView(...)` — one row per matching leg, departures grouped before returns
- Filter composition and sort, including the same-day tiebreak
- Destination filter over the reference table: ticking a **country** matches every
  destination in it, a **region** matches every city in it, and a match on either
  `destinacija_id` or `destinacija_povratka_id` counts
- Unit tests with `today` injected as a fixed string

**Done when**
- Every case in the agent's test list passes, output included in its report
- The `>=` boundary is proven: departure exactly today resolves to ↑ Odlazak
- Filtering `Grčka` matches a booking whose leg is Hanioti (city → region → country
  rollup works)
- Filtering `Beograd` matches bookings referencing it from **either** destination
  column — the Greece→Belgrade one-way and an ordinary return both appear

> This is where the app is most likely to be subtly wrong. Read the test output
> yourself — do not accept "tests pass" as a summary.

### What was built

`src/domen/` — nine modules, five test files, 2232 lines. Nothing outside the
directory changed.

| File | Purpose |
|---|---|
| `tipovi.ts` | `RezervacijaRed`, `Etapa`, `StavkaListe`, `StanjeListe`, sort and mode types |
| `glavna-etapa.ts` | `resolveMainLeg`, `sveEtape`, `proveriDanas` |
| `destinacije.ts` | the rollup, filter keys, the one canonical list, the checkbox tree |
| `filteri.ts` | date chips, range normalisation, badge count, mode selection |
| `pretraga.ts` | diacritic-folding search over name, phone and destination |
| `sortiranje.ts` | primary sort plus the same-day tiebreak |
| `liste.ts` | `rasporedView`, `danView`, `pretragaView`, `prikaziListu`, grouping |
| `index.ts` | the single import surface for the UI phase |
| `fiksture.ts` | test-only; mirrors the eight seed rows at a fixed `DANAS = "2026-01-15"` |

### Evidence

Re-run and read in the main session, not taken from the agent's summary.

- **178 tests pass**, 93 of them new (`npx vitest run src/domen` → 6 files, 93
  tests). `npm run test:tz` → identical under UTC · Europe/Belgrade ·
  Europe/Athens · Pacific/Auckland · America/Los_Angeles, closing with
  *"Svih 5 vremenskih zona daje isti rezultat."*
- `npm run typecheck` exit 0 · `npm run lint` exit 0.
- **No database import.** The only `@/db` reference in the whole directory is a
  type-only import of three `$inferSelect` types from `schema.ts`, which is
  erased at compile time. `schema.ts` has no `server-only`; `queries.ts` does,
  and is never reached.
- **The structural row type cannot drift from the real one.** A temporary probe
  asserting `RezervacijaRed` from `src/db/queries.ts` and from
  `src/domen/tipovi.ts` are assignable **both ways** typechecked at exit 0. The
  probe was deleted afterwards; `git status` shows only `?? src/domen/`.
- **Mutation testing** — the agent broke the code four ways and confirmed the
  suite caught each: `>=` → `>` (11 failures), destination filter reading the
  reservation instead of the leg (6), `uporediTekst` → byte compare (2),
  departures-before-returns tiebreak removed (5).
- The `>=` boundary is named in the test list twice: *"departure exactly today →
  still outbound"* and *"flips the day AFTER departure, not on it"*.
- Rollup proven both directions: *"a country matches every city in it (Grčka →
  Hanioti)"* and *"a region matches only its own cities (Kasandra → Hanioti and
  Siviri, not Sarti)"*. Filter keys are built on `drzava_sifra`, not the display
  name, so re-seeding a renamed country cannot invalidate a saved filter.
- Both-columns rule proven: *"a place matches from BOTH destination columns"*
  and *"a departed trip leaves the Grčka filter, because its leg is now home"*.

### Three interpretations, flagged rather than resolved silently

**1. The departed-with-no-return booking is reachable in Dan mode.** The agent
brief said "excluded from both modes"; SPEC §1's edge-case table says reachable
"by search on the name, **or by filtering its past departure date**." SPEC won —
`danView` is purely leg-in-range and applies neither the main-leg rule nor the
today horizon. The booking is still absent from Raspored entirely.

**2. `pretragaView` is a third list shape, and SPEC §2 names only two.** SPEC §3
says search "is the only way to reach a booking that has no main date", but such
a booking has no main leg to render, so it cannot be a row in either named mode.
`pretragaView` emits one row per matching reservation, showing the main leg where
there is one and the past departure leg where there is not. `prikaziListu`
dispatches: date filter → `dan`, else search → `pretraga`, else `raspored`.
**This is a real addition to SPEC §2 and should be written into the spec.**

**3. What feeds the filter checkboxes.** Per SPEC §5, `destinacijeZaFilter` is
every **active** destination ∪ **anything any booking references**, from either
column, deduped by id. Ljubljana is absent with no bookings and appears exactly
once with the seed rows.

Two smaller calls, both documented in the code: the filter tree sorts
alphabetically at every level rather than by `redosled` (that column is the
client's display order for the booking dropdowns), and descending sort reverses
only the primary key — departures still precede returns within a day, since that
is a rule about a day, not about direction.

### Two things Phase 5 needs to know

- `StavkaListe.kljuc` is `<id>#<smer>`, **not** the reservation id. A same-day
  round trip emits two rows for one reservation, so the id alone is not a safe
  React key.
- `resolveMainLeg` deliberately does *not* apply the "from today forward"
  horizon — a booking that departed and returned last month still resolves to
  its return leg, which is what the detail screen wants. `rasporedView` owns the
  horizon.

---

## Phase 4 — Auth and RLS ✅

**Agent:** `security` · **Completed 28.08.2026.**

**Fully unblocked — Block B closed 28.08.2026.** Both accounts exist in
`auth.users`, confirmed, and the badge names and colours are settled:

| User id | Badge name | Colour |
|---|---|---|
| `56231ad7-e99a-4425-ae45-f87a82b2c07d` | Mihajlo | `#2563eb` |
| `22ecbb36-23fd-4d78-905d-fb8f0d2c89ca` | Petar | `#d97706` |

**The profile swap needs a specific order.** The two placeholder profiles
cannot simply be deleted or re-keyed: the eight seed reservations reference
them and both FKs are `ON DELETE RESTRICT` with no `ON UPDATE CASCADE`, so
an in-place `update profiles set id = …` is blocked just as a delete is.
The migration must, in one transaction:

1. insert the two real profile rows, taking `email` **from `auth.users`**
   rather than a literal — `src/db/seed.ts` is committed to GitHub and must
   not carry either account holder's personal address;
2. re-point `reservations.kreirao` from each placeholder to its real id
   (4 rows each, currently split evenly);
3. delete the two placeholder rows;
4. only then add the `profiles.id` → `auth.users(id)` foreign key.

Doing 4 before 1–3 fails: the placeholder UUIDs are absent from `auth.users`.

**RLS is already on.** `drizzle/0001_ukljuci_rls.sql` enabled it on all four
tables with no policies, so the door is locked by default and the publishable key
reads nothing. This phase writes the policies that let authenticated users in — it
does not start by opening anything.

**Deliverables**
- Supabase Auth via `@supabase/ssr` — browser, server and admin clients
- ~~`middleware.ts`~~ **`src/proxy.ts`** refreshing the session and protecting
  everything except `/prijava` and static assets — renamed in Next 16, see below
- `/prijava` screen in Serbian with correct `autocomplete` attributes
- **RLS policies for every table, written into migrations** (see SPEC §9)
- `profiles.id` becomes a real foreign key to `auth.users(id)`
- The two placeholder UUIDs in `seed.ts` replaced with the real account ids, or a
  trigger that creates the `profiles` row on user creation

**Done when**
- Logging in persists across a browser restart and across several days
- Every route redirects to `/prijava` when logged out
- `select * from pg_tables where schemaname='public' and rowsecurity=false`
  returns **zero rows**
- Curling the REST endpoint with only the publishable key and no session returns
  nothing from `reservations`; the same curl **with** a session returns rows
- `SUPABASE_SECRET_KEY` appears in no client bundle
- No password appears anywhere in the repo or in any env file I wrote

**Not blocked.** You create the two accounts in the Supabase dashboard and set
their passwords there. I never handle them.

### What was built

| File | Purpose |
|---|---|
| `drizzle/0002_profili_i_rls_politike.sql` | real profiles, the `auth.users` FK, 9 RLS policies |
| `drizzle/meta/0002_snapshot.json`, `_journal.json` | hand-written migration, journal kept consistent |
| `src/lib/supabase/client.ts` | browser client (publishable key) |
| `src/lib/supabase/server.ts` | per-request server client, publishable key + cookie session |
| `src/lib/supabase/admin.ts` | secret key, server-only, bypasses RLS |
| `src/lib/supabase/middleware.ts` | session refresh + redirect logic |
| `src/proxy.ts` | route protection (**not** `middleware.ts` — see below) |
| `src/app/prijava/{page,prijava-forma,actions}.tsx` | login screen and Server Action |
| `src/app/actions/nalog.ts` | logout |
| `src/db/schema.ts` | models `auth.users` via `pgSchema("auth")`, reference-only |
| `src/db/seed.ts` | placeholder UUIDs gone; reads ids and emails from `auth.users` |

### One deviation from this plan, and it is correct

This plan said `middleware.ts`. **Next 16 deprecated that file and export in
favour of `proxy.ts` / `export function proxy`** — confirmed in the bundled docs
at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
*"The `middleware` file convention is deprecated and has been renamed to
`proxy`."* The build output confirms it is wired up, printing `ƒ Proxy (Middleware)`.
This is exactly the class of breaking change `AGENTS.md` exists to warn about.
**The wording above and in `.claude/agents/security.md` should be corrected.**

### Evidence

Re-verified in the main session against the live hosted project — not taken from
the agent's report.

- **`pg_tables … rowsecurity = false` → zero rows.** All four tables still RLS-on.
- **9 policies, every one scoped to `authenticated`.** Counted from `pg_policies`:
  `reservations` select/insert/update/delete, `profiles` select + update-own-row,
  `destinacije` select, `settings` select/update. **Policies granting anything to
  `anon`: 0.**
- **Anon curl, publishable key, no session** → `HTTP 200 []` from *all four*
  tables: `reservations`, `profiles`, `destinacije`, `settings`.
- **Anon writes change nothing.** `POST /rest/v1/reservations` → `HTTP 401`.
  `DELETE` → `HTTP 204` **but zero rows removed** — PostgREST reports success
  while RLS filters every row out of scope. Reservation count before and after:
  **8 and 8**. Worth knowing: a 204 here is not a breach, but it does not read
  like a rejection either.
- **The `auth.users` foreign key is real and enforcing.** `information_schema`
  reports it as absent — a privilege false-negative, because `auth.users` is
  owned by another role. `pg_constraint` shows
  `profiles_id_users_id_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`,
  and a live insert of a profile whose id is not an auth user was **rejected**
  by that constraint (tested in a rolled-back transaction).
- **Profiles are the real accounts.** Two rows, `Mihajlo` `#2563eb` and `Petar`
  `#d97706`, both present in `auth.users`, and each row's `email` **matches
  `auth.users.email` exactly** — proving it was copied by the migration rather
  than typed in. Placeholder profiles remaining: **0**.
- **All 8 reservations survived the re-point**, 4 to each account.
- **Route protection**, tested against a real `next start` server: `/`,
  `/nepostojeca-ruta`, `/detalji/abc`, `/podesavanja` → **`307` to `/prijava`**;
  `/prijava` itself → `200`.
- **No secret in anything the browser receives.** Clean rebuild, then grep of
  `.next/static` for the literal secret value, `sb_secret_`, `SUPABASE_SECRET_KEY`
  and connection strings → **0 files each**. The served `/prijava` HTML likewise
  contains none. The secret's only occurrence anywhere under `.next` is
  `.next/cache/turbopack/….sst`, a local build cache, and `/.next/` is gitignored.
- `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npm run test` 178/178 ·
  `npm run build` succeeds (routes `/` and `/prijava`, plus the Proxy).

### Session longevity — what was and was not verified

The refresh cookie is written with `Max-Age=34560000` (400 days), and
`azurirajSesiju` calls `getClaims()` on every navigation, which refreshes an
access token that is near expiry. So the *mechanism* for surviving a browser
restart and a multi-day gap is in place and was observed in a real `Set-Cookie`.
**Nobody waited days.** Elapsed-time behaviour is unverified and stays unverified
until Phase 9 on the owner's actual phone.

### A mistake the agent flagged rather than hid

While testing the cookie round trip it ran one `curl -i` that printed a
`Set-Cookie` containing a full session JWT — which embeds the account email —
into its own transcript. It caught this, switched to silent curls with cookie
jars, and revoked the session with `signOut({scope:"global"})`.

**Verified in the main session:** `auth.sessions` → **0 rows**;
`auth.refresh_tokens` → **0 total, 0 active**. The leaked token is dead. No
password was involved at any point — the test sessions were minted via
`admin.generateLink()` + `verifyOtp()`, never `signInWithPassword`.

### Two things Phase 5 should know

- **`src/lib/supabase/client.ts` is currently unused.** `sb_publishable_` appears
  in **zero** files under `.next/static`, because login runs through a Server
  Action and nothing client-side has needed the browser client yet. It is correct
  code, but it is untested in a real bundle — the first client component to use
  it is the first real exercise of that path.
- **Deleting an account in the dashboard will fail while it has reservations.**
  `profiles.id → auth.users(id)` is `ON DELETE CASCADE`, but
  `reservations.kreirao → profiles.id` is `ON DELETE RESTRICT`, so the cascade is
  blocked. That is the safe direction — no silent data loss — but it is a
  surprise if someone tries it.


---

## Phase 5 — Screens ✅

**Agent:** none — built in the main session. **Completed 01.09.2026.**

**Deliverables**
- **Lista** — sticky header, date-grouped cards, direction chips, creator badges
- **Filter** — bottom sheet, date chips, destination checkboxes **grouped by
  country** (collapsible), count badge
- **Nova / Izmeni** — Server Action + `useActionState`, native date inputs,
  **three cascading dropdowns per leg** (Država → Regija → Grad), **⇅ swap button**
- **Detalji** — *Pozovi* / *WhatsApp*, edit, delete behind a confirm Dialog
- **Podešavanja** — default home destination

**Done when**
- No horizontal scroll at 375px
- Touch targets ≥ 44px, inputs ≥ 16px font
- Primary actions in the bottom third, safe-area insets respected
- Cascade resets correctly: changing country clears region and city
- Regions containing exactly one city auto-select and hide the third dropdown
- `aktivna = false` destinations are absent from the dropdowns but still render
  correctly on an existing reservation that references one
- Zero Serbian strings inlined in JSX — all from `tekst.ts`
- Zero filtering or sorting reimplemented in components

### What was built

Five routes, ten components, three new modules, two new test files.

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Lista — reads `searchParams`, calls `danasBeograd()` once |
| `src/app/nova/page.tsx` | Nova rezervacija |
| `src/app/rezervacija/[id]/page.tsx` | Detalji |
| `src/app/rezervacija/[id]/izmeni/page.tsx` | Izmeni |
| `src/app/podesavanja/page.tsx` | Podešavanja, plus the logout button |
| `src/app/actions/rezervacije.ts` | create · edit · delete Server Actions |
| `src/app/actions/podesavanja.ts` | default home destination |
| `src/components/filter-sheet.tsx` | the bottom sheet — date, sort, destinations |
| `src/components/kaskada-destinacija.tsx` | Država → Regija → Grad |
| `src/components/forma-rezervacije.tsx` | the shared Nova/Izmeni form |
| `src/components/lista-rezervacija.tsx` | day headings and the Polasci/Povratci split |
| `src/components/kartica-rezervacije.tsx` | one card — renders a *leg*, not a booking |
| `src/components/polje-pretrage.tsx` | debounced search into the URL |
| `src/components/dugme-brisanja.tsx` | delete behind the confirm Dialog |
| `src/components/forma-podesavanja.tsx`, `izbor.tsx`, `cip-smera.tsx`, `bedz-autora.tsx` | settings form, native select, direction chip, creator badge |
| `src/domen/izbor-destinacija.ts` | the checkbox selection algebra (+ 21 tests) |
| `src/domen/kaskada.ts` | the form's dropdown lists (+ 11 tests) |
| `src/lib/validacija.ts` | the Zod schema shared by form and action (+ 12 tests) |
| `src/lib/url-stanje.ts` | filter/sort/search ⇄ query string |
| `src/lib/navigacija.ts` | the `nazad` path guard |
| `src/lib/auth.ts` | `zahtevajKorisnika()` — see below |

**Filter state lives in the URL, not in React state.** The list stays a Server
Component that renders once; a filtered view is linkable and survives a reload;
and the back button steps through filter changes the way a phone user expects.

**Three new domain modules, because the gate says zero logic in components.**
The checkbox algebra (ticking a country, then unticking one city inside it) and
the dropdown ordering are both filter logic and both are tested. Note that the
two orderings differ on purpose: the *form* dropdowns follow `redosled`, the
client's own display order, while the *filter* tree stays A–Z — that split was
already decided in Phase 3 and is now load-bearing in two places.

### One addition beyond the plan, and the reason for it

**`src/lib/auth.ts` — every page and action re-checks the session itself.**

The screens read through `src/db/queries.ts`, which connects as `postgres`, the
owner of the tables, and therefore **bypasses RLS entirely**. For a REST call
with the publishable key, RLS is the boundary and Phase 4 proved it holds. For a
server render it is not in the path at all, and the only thing between an
unauthenticated request and the reservations would have been `src/proxy.ts` —
which is a convenience redirect by its own documentation, and which sits on a
layer that has had a real bypass (CVE-2025-29927). `zahtevajKorisnika()` repeats
the check where the data actually is. It is cheap: `getClaims()` verifies the
JWT locally.

### Evidence

Run in the main session, not summarised from anywhere.

- `npm run typecheck` exit 0 · `npm run lint` exit 0 (see the note below).
- `npm run test` — **222 passed, 13 files**, up from 178/11. The 44 new tests are
  the selection algebra (21), the cascade lists (11) and the form schema (12).
- `npm run test:tz` — **222 tests identical under UTC · Europe/Belgrade ·
  Europe/Athens · Pacific/Auckland · America/Los_Angeles**, closing with
  *"Svih 5 vremenskih zona daje isti rezultat."*
- `npm run build` succeeds. Seven routes, five of them new, plus `ƒ Proxy`.
- **Route protection, against a real `next start`:** `/`, `/nova`,
  `/podesavanja`, `/rezervacija/<uuid>` and `/rezervacija/abc/izmeni` all return
  **307 → `/prijava`**; `/prijava` itself returns 200. Confirmed in a browser as
  well: `http://localhost:3000/` lands on the login screen.
- **Zero Serbian strings inlined in JSX.** A diacritic grep over `src/app` and
  `src/components` returns only prose inside comments. It caught one real hit —
  `layout.tsx` had `title` and `description` spelled out; both now come from
  `T.app`.
- **No Cyrillic character anywhere in `src`**, checked across every `.ts`/`.tsx`.

**Three lint errors were fixed rather than suppressed.** `react-hooks/set-state-in-effect`
flagged the search box, the filter sheet and the cascade — all three were the
"derive state from a prop" pattern written as an effect. All three are now
render-phase state adjustments, which is both what React documents and one fewer
wasted frame showing stale content.

### Two interpretations, flagged rather than resolved silently

**1. Day headings follow the sort, not the mode.** `grupisiPoDanu` starts a new
group whenever the date changes, so sorting by destination would render a column
of one-row day groups. Sorted by destination the list therefore goes flat and
each card carries its own date instead. SPEC §6 describes the date-grouped
shape and does not say what should happen under the §3 destination sort; this is
the gap being filled.

**2. Nova leaves the departure date and the passenger count blank.** Neither is
pre-filled, though today and `1` were both available. A booking that silently
departs today, or silently carries one passenger where the answer was four, is a
dispatch failure that looks like a correctly filled-in form. An empty field asks
a question; a wrong default answers it. Costs one tap each.

Two smaller calls, both documented in the code: the ⇅ swap exchanges the two
*destinations* and leaves the dates alone (a departure date is a departure date
whichever way the van is pointing), and the filter sheet also hosts the sort
controls rather than opening a second sheet for two toggles.

### Device gates — closed 01.09.2026

Driven by hand in Chrome at a phone viewport, signed in, against the real
hosted database. Clicks went through the DOM rather than screen
coordinates, because the captured frame was scaled and coordinate clicks landed
in the wrong place.

**Nothing was written.** No booking was created, edited or deleted; the delete
dialog was opened and cancelled. Counts before and after the whole pass:
`reservations=8 profiles=2 destinacije=44 settings=1`.

- **No horizontal scroll at 375px.** Chrome on Windows will not size a window
  below ~393px, so each route was measured inside a same-origin iframe pinned
  to exactly 375px. `scrollWidth - clientWidth = 0` on `/`, `/?od=…` (Dan),
  `/?q=…` (Pretraga), `/?sort=destinacija`, `/nova` and `/podesavanja`.
- **Touch targets and font size.** Every visible `button`, `a`, `input`,
  `select` and checkbox row on `/`, `/nova` and `/podesavanja` measured at
  375px: **zero** under 44×44, **zero** inputs under 16px. The Filter trigger
  measures 85×44 exactly.
- **The main leg rule, on real rows.** Today 01.09.2026, Raspored shows
  **5 rezervacija** — and the three absent ones are absent for three different
  correct reasons: Stefan Nikolić and Ana Marković departed with no return date
  (no main leg at all), Dragan Đorđević's return was 30.08 (main date in the
  past, outside the horizon). Jelena Ilić and Porodica Jovanović render as
  ↓ Povratak → Beograd; Marko Petrović, who has not left, is still
  ↑ Odlazak → Hanioti — the SPEC §1 worked example, live.
- **Destination rollup.** `?d=drzava:grcka` → **1 rezervacija**, Marko
  Petrović / Hanioti. Country → city rollup works, and the three departed Greek
  trips correctly leave the Grčka filter because their leg is now home.
- **The filter writes one key, not seventeen.** Ticking Grčka produced
  `?d=drzava%3Agrcka`. `sazmiIzbor` is doing its job where it is visible — in
  the URL and in the badge count.
- **Dan mode and the same-day round trip.** `?od=2026-08-30` renders
  **POLASCI** then **POVRATCI**, and Dragan Đorđević appears in *both* — one
  row per leg from one booking, which is what `kljuc = <id>#<smer>` exists for.
  Within Polasci, Hanioti before Kopaonik (destination A–Z).
- **Both routes to a booking with no main date.** `?od=2026-08-31` reaches Ana
  Marković under the heading **juče** (SPEC §1: "by filtering its past
  departure date"); `?q=nikoli` reaches Stefan Nikolić (SPEC §3: search).
  Search also folds diacritics — `nikoli` matched `Nikolić`.
- **Pluralisation in the wild.** `1 rezervacija` · `3 rezervacije` ·
  `5 rezervacija`, and `1 putnik` · `2 putnika` · **`21 putnik`** on Dragan
  Đorđević's minibus.
- **The cascade, all 14 regions.** Walked every country and region on `/nova`.
  Every region holding exactly one city auto-selects it and hides the third
  dropdown; every region with more than one shows it and selects nothing.
  That is 8 single-city regions — SPEC's list of ten minus Sarajevo and
  Jahorina, which are in BiH and correctly not offered. The rule is
  implemented, not the list. Changing country clears region and city.
- **The two destination lists really are different.** `/nova` offers Grčka,
  Hrvatska, Italija, Makedonija, Srbija — no Slovenija, no BiH. The **filter**
  offers Slovenija (the Ljubljana booking references it) but not BiH (nothing
  does). Opening **Šaban Šaulić** for editing offers Slovenija *and* pre-fills
  Slovenija › Slovenija with the third dropdown hidden. Both halves of SPEC §5
  proven on the same data.
- **The ⇅ swap.** With Grčka › Kasandra › Hanioti outbound and the pre-filled
  Beograd return, one tap exchanged both ids *and* both cascades re-derived
  their country and region from the new values — Grčka/Kasandra moved to the
  return leg, Srbija/Beograd to the outbound. One tap for a homecoming-first
  booking, as SPEC §5 asks.
- **Podešavanja pre-fills the return leg.** A fresh `/nova` opens with the
  return already set to `Srbija › Beograd › Beograd` from the settings row,
  third dropdown hidden.
- **Detalji.** `tel:+381667778899` and `https://wa.me/381667778899` — E.164 for
  the dialler, digits-only for WhatsApp, both dialable from a foreign network.
  Long dates render as `7. septembar 2026.` and the full path as
  `Slovenija › Slovenija › Ljubljana`.
- **Delete is guarded.** The button opens a dialog reading *"Obrisati
  rezervaciju?" / "Brisanje je trajno. Rezervacija se ne može vratiti."* with
  Odustani and Obriši. Only the confirm button sits inside the form that posts
  to the Server Action. Cancelled; the booking is still there.

### Added after sign-off — the card shows both ends of the leg

01.09.2026, on the owner's request: a card reading `↓ Povratak · Beograd` says
they are arriving but not where from, which is half the dispatch question. Cards
now read `Solun → Beograd` on a return and `Beograd → Hanioti` on a departure.

**The origin is inferred, because there is no origin column.** SPEC §4 has
`destinacija_id` and `destinacija_povratka_id` and the nine columns are fixed,
so the far end of a leg is the *other* column, picked by direction —
`rutaEtape` in `src/domen/glavna-etapa.ts`, with 8 tests. That is exact for a
round trip and for the one-way ride home, where the outbound column already
holds home.

**It has one honest limit.** The Greece → Beograd one-way is entered with
Beograd in the outbound column and Beograd as the return, so both ends are the
same row and the Greek town they set out from was never recorded anywhere.
Rather than draw an arrow from Beograd to Beograd, the card collapses to the
single name — Ana Marković renders as `↑ Odlazak · Beograd`. If the owner wants
that origin, it needs a tenth column, which is a SPEC change and not this one.

A side benefit worth noting: the same-day round trip is now legible. Dragan
Đorđević's two rows on 30.08 used to read `Kopaonik` and `Beograd`; they now
read `Beograd → Kopaonik` and `Kopaonik → Beograd`.

Re-verified at 375px after the change: **zero horizontal overflow** on `/`,
`/?od=…` and the Dan view. The origin is the half that ellipsizes and the
destination never shrinks, so the place the van is going is always fully
visible — stress-tested with names far longer than any real destination
(`Bosanski Petrovac na Uni → Sveti Stefan Crnogorski`): still zero overflow,
origin truncated, destination intact.

### Added after sign-off — jednosmerna vožnja

01.09.2026, on the owner's request, and it closes the limit flagged in the
section above: a one-way ride home could not record where it started.

**No tenth column.** A booking with no `datum_povratka` is already a one-way —
SPEC §8 has the return leg optional — so the checkbox does not store a new
fact, it makes an existing absence sayable out loud. Ticking it clears the
return date, relabels the second leg from *Povratak* to **Odakle**, and puts
it first, because "from Solun to Beograd" is the order someone says it in.
`jeJednosmerna` in `src/domen/glavna-etapa.ts`, with tests.

**The second column is read as the origin.** On a round trip
`destinacija_povratka_id` is home, which is also where they set out from, so
this is a reading of the column rather than a change to it — the same reading
`rutaEtape` already applies to every outbound leg. Ana Marković no longer has
to collapse to a bare `Beograd`: the same trip entered as a one-way now records
Solun and renders `Solun → Beograd`.

**One thing the data still cannot say.** "This trip is one-way" and "the return
is not confirmed yet" are both an absent `datum_povratka`, and nothing
distinguishes them. Nothing in the app behaves differently between the two, so
nothing is lost today — but it is why the initial state of the checkbox is
passed in per screen rather than inferred: **Nova** opens as a round trip
(SPEC §4 has the return date filled in later), **Izmeni** opens ticked when the
stored booking has no return date. Inferring it uniformly made every new
booking default to one-way, which was caught in the browser and fixed.

**The detail screen had a real hole.** It only ever rendered
`destinacijaPovratka` when a return date existed, so on a one-way the origin
was invisible — it showed only "Povratak nije dogovoren". A one-way now renders
**ODAKLE / KUDA / POVRATAK**.

### Evidence

End to end against the live database, which meant writing for the first time:
one booking created through the form and deleted through the UI afterwards.

- Ticking the box: legends go `Odlazak · Povratak` → `Odakle · Kuda`, the
  return-date field disappears, and the pre-filled origin id survives the
  reorder. Unticking restores all three.
- **A one-way saved and rendered.** `Odakle Grčka › Solun i okolina › Solun`,
  `Kuda Srbija › Beograd`, 20.09.2026, no return. The list card read
  **`↑ Odlazak Solun → Beograd · 2 putnika`** — the exact shape that was
  impossible before. The phone normalised from `0641234567` to
  `+381 64 1234567` on save.
- Detail rendered `ODAKLE Grčka › Solun i okolina › Solun` / `KUDA
  20. septembar 2026.` / `POVRATAK Povratak nije dogovoren`.
- **Create and delete both exercised for the first time.** The test row was
  removed through the confirm dialog; `reservations` is back to **8** with
  zero `TEST%` rows left behind.
- 375px re-checked in both form states: **zero horizontal overflow**. The
  one-way checkbox's own box is 20×20, but the tap target is its label at
  262×64 and clicking the label toggles it — the same pattern the filter sheet
  already uses.
- 233 tests, identical across five timezones; typecheck, lint and build clean.

One thing that is still **not** verified, and cannot be from a desktop browser:
`tel:` actually dialling from a foreign network, and the session surviving a
multi-day gap. Both are Phase 9, on the owner's phone.

---

## Phase 6 — Installable and offline

**Agent:** `ui`

**Deliverables**
- Serwist service worker with per-route caching strategy, wired into
  `next.config.ts` — there is currently no Serwist configuration at all
- Manifest, icons (192, 512, **512 maskable**), `apple-touch-icon` 180. `public/`
  is empty; all of it needs creating
- Offline indicator bar; save disabled with a clear reason when offline
- iOS Add-to-Home-Screen hint; Android `beforeinstallprompt` button

**Done when**
- App shell and list render with the network disabled
- **Mutations are never cached or queued** — they fail loudly
- Session survives the transition into iOS standalone mode (verified, not assumed)

---

## Phase 7 — Verification gate

**Agent:** `tester` · **Nothing deploys until this passes.**

Prompt it with: *"Verify the implementation against SPEC.md. Report findings with
evidence."*

Runs the full matrix: main leg edge cases, the `>=` boundary, destination cascade
and filter rollup, filter/sort semantics, Serbian collation and pluralization,
mobile at 375px, data safety, RLS, and the timezone check.

**The timezone check is the highest-value item:** run with `TZ=Pacific/Auckland`,
`TZ=UTC` and `TZ=Europe/Athens` around a date boundary. The list must be
**identical** in all three.

**Then:** run `/code-review` for code quality. Fix findings, re-run Phase 7.

**Done when:** no correctness bugs and no spec deviations remain open.

---

## Phase 8 — Deploy

**Agent:** `developer`

The Supabase half of this phase is already done — the project exists, migrations
are applied and the data is seeded. What remains is everything around it.

**Deliverables**
- Vercel project linked to the GitHub repo, env vars set
- Runtime uses the **pooled** connection (6543); migrations use the **session**
  one (5432), as a build step or separate job, never in the request path
- `/api/health` checking database connectivity
- Sentry with PII scrubbed in `beforeSend` — this app stores names and phone numbers
- GitHub Action: `typecheck` + lint + tests on PR
- **Nightly `pg_dump` GitHub Action** — backup *and* keep-alive
- `RUNBOOK.md` with the restore procedure and how to re-seed destinations

**Done when**
- Production URL loads and login works
- ~~The nightly backup job has run at least once and produced a real dump~~ ✅
- ~~A restore has been performed into a scratch database and **verified** — not
  just enabled~~ ✅

### Backups ✅ — 01.09.2026

`.github/workflows/rezerva.yml`, nightly at 01:30 UTC. First green run produced
commit `2f03368` on the orphan branch `rezerve`:

```
     836 B  csv/2026-09-01-rezervacije.csv
     836 B  csv/rezervacije-najnovije.csv
    4937 B  dump/2026/2026-09-01.sql.gz
```

`git merge-base origin/main origin/rezerve` finds nothing — genuinely orphan,
so a clone of the code never drags backups along.

**The committed artifact was restored, not just the local one.** The `.sql.gz`
was pulled back out of the branch, rewritten into a scratch schema and replayed
inside a transaction that was rolled back:

| | |
|---|---|
| destinacije | **67** |
| profiles | **2** |
| reservations | **8** |
| settings | **1** |

Sample rows came back readable (`Porodica Jovanović · 2026-08-23 · Siviri`).
Afterwards: `reservations=8` unchanged and no scratch schema left behind. The
67 confirms it is genuinely today's data, not a stale capture — it was 44
before the Serbian pickup towns landed the same day.

The dump carries 4 tables, 9 policies, 4 data blocks and **zero** rows from
`auth`, so a backup cannot leak a password hash.

Two bugs were fixed before it went green, both mine:
1. The job began with `actions/checkout` on the `rezerve` branch — which does
   not exist on a first run. Removed entirely; the job never needed the source.
2. `postgresql-client-17` installed fine, but `/usr/bin/pg_dump` is
   postgresql-common's wrapper and kept resolving to the runner's pre-installed
   16, aborting on `server version mismatch` against a 17.6 server. Now called
   by absolute path, with the major version asserted before any dump runs.

> Backups are the only safety net in this app: deletion is permanent, there is no
> status column and no undo, and dev and production are the same database. On
> Supabase's free tier there are no managed daily backups **and** the project
> pauses after 7 days of inactivity — a quiet week in winter would take the app
> offline. The nightly `pg_dump` job solves both at once, because the daily query
> counts as activity. It is not optional.

---

## Phase 9 — Handover

**Agent:** none — main session.

- Create the two real accounts in the Supabase dashboard and wire their profiles
- Install to the owner's phone: iPhone is Share → *Add to Home Screen* (no
  install prompt exists on iOS — walk him through it once); Android Chrome offers
  a real install button
- Enter one real reservation together and confirm both accounts see it
- Confirm *Pozovi* dials correctly **from a foreign network** if possible
- Set the default home town in Podešavanja

---

## Standing rules for every phase

1. **`SPEC.md` is the source of truth.** If an agent wants to deviate, it reports
   the conflict rather than resolving it silently.
2. **The nine columns are fixed.** No `status`, no `note`, no timestamps. Removed
   deliberately.
3. **Destinations are reference data, never free text.** Seeded from
   `data/destinacije.json`, chosen from cascading dropdowns. The filter is **one
   canonical list** — a place appears once and matches from **either** destination
   column. Grouping by country is fine; grouping by trip-versus-home is not.
   Destination rows are never deleted, only deactivated. See `SPEC.md` §5.
4. **Dates are `YYYY-MM-DD` strings end to end.** No JS `Date` in the pipeline,
   no `timestamptz`, no `toISOString()` on a calendar date.
5. **"Today" is always Belgrade**, always injected, never read from the device.
6. **Deletion is permanent.** Confirm dialog required; backups verified.
7. **RLS is the security boundary, not the middleware.** Every table in `public`
   has RLS enabled, policies live in migrations, and the secret key never
   reaches the browser.
8. Agents report what they actually ran and observed. "Looks fine" is not a result.
9. **There is one database and it is the real one.** No Docker, no local stack.
   Destructive commands are gated — `npm run db:reset` requires
   `POTVRDA="OBRISI SVE"` — and nobody bypasses the gate.

---

## Open items

- [x] ~~Account credentials~~ — you create the two accounts in the Supabase
      dashboard and set the passwords there. No seed script, no self-registration.
- [x] ~~Dropdown levels~~ — **confirmed three**: Država → Regija → Grad, third one
      auto-selected and hidden where a region contains exactly one city
- [x] ~~Default home destination~~ — **confirmed `Srbija › Beograd › Beograd`**
      (28.08.2026). The seed writes it into the `settings` row.
- [x] ~~Nightly backup~~ — `.github/workflows/rezerva.yml`, built 01.09.2026.
      Dumps `public` only (never `auth`), writes a readable CSV, commits to the
      orphan branch `rezerve`, refuses to save an empty dump, and doubles as
      the keep-alive. **Green and proven in production 01.09.2026** — commit
      `2f03368` on branch `rezerve`, and that committed dump was restored into
      a scratch schema in a rolled-back transaction: 67 destinacije, 2 profila,
      8 rezervacija, 1 settings. Procedure in `RUNBOOK.md`.
- [x] ~~Serbian pickup towns~~ — the 23 largest added to
      `data/destinacije.json` on 01.09.2026, each its own single-city region,
      Beograd still first and still the default. 67 destinations total.
- [x] ~~SPEC drift~~ — `SPEC.md` brought back in line with the code on
      01.09.2026 and given a changelog. All six disagreements closed.
- [ ] Re-check the non-Serbian half of `data/destinacije.json` against the live
      site before launch; it was captured 27.08.2026 and the client edits their
      own site
- [x] ~~`profiles` has no `password_hash`~~ — settled 01.09.2026 and still no
      password column. Supabase Auth owns credentials in `auth.users`, which
      hashes, salts and rate-limits them; a second copy in `public` would be a
      source of truth that can disagree with the first, in a schema reachable
      over PostgREST. What the owner actually wanted — *"profiles is the list of
      who may enter"* — is delivered by migration `0003` instead. SPEC §4 should
      be corrected to drop `password_hash` and say so.
- [x] ~~`profiles.id` foreign key and the placeholder UUIDs~~ — done in
      migration `0002`, verified by `pg_constraint` and a rejected insert.
- [x] ~~`profiles.email` copied from `auth.users`, never hardcoded~~ — done;
      each row's email matches `auth.users` exactly and no address appears in
      any tracked file.
- [ ] **This plan and `.claude/agents/security.md` both say `middleware.ts`.**
      Next 16 renamed it to `proxy.ts`; the implementation follows Next, not
      the plan. Correct both documents so the next agent does not re-add a
      deprecated file.
- [x] ~~The repo has zero commits~~ — Phases 3–5 committed and pushed to
      `origin/main` on 01.09.2026 (`b1aad88`), followed by the access-list work.
- [x] ~~SPEC §2 names two list modes; the implementation has three~~ —
      `pretragaView` is now written into SPEC §2.
- [ ] **SPEC §1 and the `domain-logic` agent brief disagree** about whether a
      departed booking with no return date is reachable in Dan mode. SPEC §1 says
      yes, by filtering its past departure date; the brief said no. SPEC was
      followed. Correct `.claude/agents/domain-logic.md` so the next run of that
      agent does not re-open it.
