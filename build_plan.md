# Build Plan — Kombi Rezervacije

Execution plan for building the app described in [`SPEC.md`](./SPEC.md), using the
agents in `.claude/agents/`.

Read `SPEC.md` first. It is the source of truth; this file is only the order of
operations.

## Status — 28.08.2026

| Phase | State |
|---|---|
| 0 · Scaffold | done |
| 1 · Data layer | done |
| 2 · Locale primitives | done |
| 3 · Domain core | **next** |
| 4–9 | not started |

**There is one database and it is the real one.** Development and production are
the same hosted Supabase project, `biqiztxeiqmrgmngemhf`, in the EU
(`eu-central-1`, Frankfurt). `.env.local` points at it, the migrations are applied
and both seeds have run. There is no Docker and no local Supabase stack — the
`supabase/` directory has been removed and the CLI is not part of this workflow.

That means the Supabase half of Phase 8 landed early, out of order. Phase 8 is now
only Vercel, CI, monitoring and backups.

It also means every command runs against live data. `npm run db:reset` is gated
behind `POTVRDA="OBRISI SVE"` and nothing else drops anything.

**Verified at the end of Phases 0–2:** `npm run typecheck` clean · `npm run lint`
clean · `npm run build` succeeds · `npm run test:tz` — 85 tests across 5
timezones, all identical.

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

## Phase 3 — Domain core ← NEXT

**Agent:** `domain-logic` · **The hardest phase. Do not rush it.**

**Ready to start.** Everything it needs exists: the schema and raw-row query
layer from Phase 1, `danasBeograd()` and `uporediTekst` from Phase 2, and eight
seed reservations already shaped around the awkward cases. Put the domain core
in `src/domen/` and keep it free of any database import, so it stays testable at
a fixed `danas`.

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

---

## Phase 4 — Auth and RLS

**Agent:** `security`

**RLS is already on.** `drizzle/0001_ukljuci_rls.sql` enabled it on all four
tables with no policies, so the door is locked by default and the publishable key
reads nothing. This phase writes the policies that let authenticated users in — it
does not start by opening anything.

**Deliverables**
- Supabase Auth via `@supabase/ssr` — browser, server and admin clients
- `middleware.ts` refreshing the session and protecting everything except
  `/prijava` and static assets
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

---

## Phase 5 — Screens

**Agent:** `ui` · The largest phase. Consider splitting across invocations:
list first, then form, then detail and settings.

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
- The nightly backup job has run at least once and produced a real dump
- A restore has been performed into a scratch database and **verified** — not just
  enabled

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
- [ ] Re-check `data/destinacije.json` against the live site before launch; it was
      captured 27.08.2026 and the client edits their own site
- [ ] `profiles` has no `password_hash` — Supabase Auth owns credentials. This
      conflicts with the letter of SPEC §4; see Phase 1.
- [ ] `profiles.id` is not yet a foreign key to `auth.users(id)`, and `seed.ts`
      uses two placeholder UUIDs. Both are Phase 4.
- [ ] **The repo has zero commits.** `git init` and the remote are done; nothing is
      tracked. Commit before Phase 8 — the Vercel deploy builds from GitHub.
