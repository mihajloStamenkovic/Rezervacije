@AGENTS.md

# Kombi Rezervacije

A shared reservation book for a two-person van transport business. Mobile-first,
Serbian (Latin script), Europe/Belgrade.

- [`SPEC.md`](./SPEC.md) is the **source of truth**. Read it before changing behaviour.
- [`build_plan.md`](./build_plan.md) is the order of operations and current status.
- `.claude/agents/` holds the seven specialists. Route work to the right one.

## Standing rules

1. **`SPEC.md` is the source of truth.** If you want to deviate, report the
   conflict rather than resolving it silently.
2. **The nine reservation columns are fixed.** No `status`, no `note`, no
   timestamps. They were removed deliberately.
3. **Destinations are reference data, never free text.** Seeded from
   `data/destinacije.json`, chosen from cascading dropdowns. The filter is **one
   canonical list** — a place appears once and matches from **either**
   `destinacija_id` or `destinacija_povratka_id`. Grouping by country is fine;
   grouping by trip-versus-home is not. Rows are never deleted, only deactivated.
4. **Dates are `YYYY-MM-DD` strings end to end.** No JS `Date` in the pipeline, no
   `timestamptz`, no `toISOString()` on a calendar date. `new Date("2026-01-01")`
   is midnight UTC and prints as the previous day in half the world.
5. **"Today" is always Belgrade**, always injected, never read from the device
   clock. Call `danasBeograd()` once at the edge and pass it down.
6. **Deletion is permanent.** Confirm dialog required; backups verified.
7. **RLS is the security boundary, not the middleware.** Every table in `public`
   has RLS enabled, policies live in migrations, and the secret key never reaches
   the browser.
8. **Report what you actually ran and observed.** "Looks fine" is not a result.
9. **There is one database and it is the real one.** Dev and production are the
   same hosted Supabase project. No Docker, no local Supabase stack. Destructive
   commands are gated — `npm run db:reset` requires `POTVRDA="OBRISI SVE"` — and
   nobody bypasses the gate.

## Layout

| Path | What lives there |
|---|---|
| `src/db/` | Drizzle schema, migrations, seeds, raw-row query layer |
| `src/domen/` | Main leg rule, list modes, filters, sort. **No database imports** |
| `src/lib/` | `datum.ts`, `telefon.ts`, `tekst.ts` — dates, phones, every Serbian string |
| `src/app/` | Routes, layouts, Server Actions |
| `src/components/ui/` | shadcn primitives — Sheet, Dialog, Input, Button, Checkbox only |

## Commands

```bash
npm run dev                  # dev server
npm run typecheck            # next typegen && tsc --noEmit
npm run test                 # vitest
npm run test:tz              # the suite under 5 timezones — must be identical
npm run db:migrate           # apply migrations (session pooler, port 5432)
npm run db:seed:destinacije  # idempotent destination seed
```
