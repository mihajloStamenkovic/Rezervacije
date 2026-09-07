@AGENTS.md

# Kombi Rezervacije

A shared reservation book for a van transport business — two owners who
dispatch, and drivers grouped into teams who each see only their own team's
bookings. Mobile-first, Serbian (Latin script), Europe/Belgrade.

- [`SPEC.md`](./SPEC.md) is the **source of truth**. Read it before changing behaviour.
- [`build_plan.md`](./build_plan.md) is the order of operations and current status.
- `.claude/agents/` holds the seven specialists. Route work to the right one.

## Standing rules

1. **`SPEC.md` is the source of truth.** If you want to deviate, report the
   conflict rather than resolving it silently.
2. **The reservation columns are fixed, and `src/db/kolone.test.ts` is the
   guard.** No `status`, no timestamps. Amended twice, both times at the
   owner's request and both times written into `SPEC.md` rather than resolved
   silently. 06.09.2026: `tim_id` — not trip data, but who may see the row;
   the owners are the dispatchers, so a booking has to be able to belong to a
   crew other than the one that entered it, and `src/domen/pristup.ts` says
   why deriving it from `kreirao` was tried and discarded. 07.09.2026:
   `adresa`, `cena` and `napomena` — the last of which **reverses** the old
   "no notes"; the note is read on Detalji and reaches no list, filter, sort
   or search, which is what the original decision was protecting. The column
   list in that test is exhaustive, so the next addition fails there first.
3. **Destinations are reference data, never free text.** Seeded from
   `data/destinacije.json`, chosen from cascading dropdowns. The filter is
   **one canonical list** — a place appears once and matches from **either**
   `destinacija_id` or `destinacija_povratka_id`. Grouping by country is fine;
   grouping by trip-versus-home is not. Rows are never deleted, only
   deactivated. Amended 06.09.2026 at the owner's request: a region or city
   missing from the list can be typed in, but what is typed **becomes a row**
   — matched first against the catalogue folded for case and diacritics, so
   one town cannot end up in the list twice, and the country is never typed. A
   reservation still points at a `destinacije` row and never at a name. See
   `SPEC.md` §5 and `src/db/rucne-destinacije.ts`.
4. **Dates are `YYYY-MM-DD` strings end to end.** No JS `Date` in the pipeline, no
   `timestamptz`, no `toISOString()` on a calendar date. `new Date("2026-01-01")`
   is midnight UTC and prints as the previous day in half the world.
5. **"Today" is always Belgrade**, always injected, never read from the device
   clock. Call `danasBeograd()` once at the edge and pass it down.
6. **Deletion is permanent.** Confirm dialog required; backups verified.
7. **RLS is the boundary for the publishable key; the query layer is the
   boundary for the app.** Every table in `public` has RLS enabled, policies
   live in migrations, and the secret key never reaches the browser — but the
   screens read through Drizzle as the table owner, which *bypasses RLS
   entirely*. What stops one team seeing another's bookings in the app is the
   `WHERE` clause built in `src/db/vidljivost.ts`. Under a flat book that
   distinction cost nothing. Since teams it is the whole thing, and a policy
   written without a matching change to the query layer changes nothing a user
   can see.
8. **Report what you actually ran and observed.** "Looks fine" is not a result.
9. **There is one database and it is the real one.** Dev and production are the
   same hosted Supabase project. No Docker, no local Supabase stack. Destructive
   commands are gated — `npm run db:reset` requires `POTVRDA="OBRISI SVE"` — and
   nobody bypasses the gate.

## Layout

| Path | What lives there |
|---|---|
| `src/db/` | Drizzle schema, migrations, seeds, raw-row query layer, and `rucne-destinacije.ts` — the one place a typed place becomes a row |
| `src/domen/` | Main leg rule, list modes, filters, sort, access rule (`pristup.ts`). **No database imports** |
| `src/lib/` | `datum.ts`, `telefon.ts`, `novac.ts`, `tekst.ts` — dates, phones, prices, every Serbian string |
| `src/app/` | Routes, layouts, Server Actions |
| `src/components/ui/` | shadcn primitives — Sheet, Dialog, Input, Button, Checkbox, Textarea only (Textarea added 07.09.2026 for the reservation note, which is a paragraph and not a line) |

## Commands

```bash
npm run dev                  # dev server
npm run typecheck            # next typegen && tsc --noEmit
npm run test                 # vitest
npm run test:tz              # the suite under 5 timezones — must be identical
npm run db:migrate           # apply migrations (session pooler, port 5432)
npm run db:seed:destinacije  # idempotent destination seed
```
