# Kombi Rezervacije

A shared reservation book for a two-person van transport business running routes
between Serbia and Greece, Croatia, Italy and the region.

Two accounts, one list, both see everything. It lives on a phone — mobile-first,
installable to the home screen, and readable with no signal. The interface is in
Serbian (Latin script) and the business timezone is fixed to Europe/Belgrade, so
both accounts see the same list from any country.

- **[`SPEC.md`](./SPEC.md)** — what it does and why. The source of truth.
- **[`build_plan.md`](./build_plan.md)** — order of operations and current status.
- **[`SETUP.md`](./SETUP.md)** — what the owner needs to provide.

## The idea it turns on

Every reservation has two legs — going out and coming home — but only ever **one
main date**, and which leg that is depends on today. A booking to Greece is a
departure until the day it leaves, then it becomes a homecoming to Belgrade. Same
row in the database; only today's date changed.

That rule, the two list modes built on it, and the destination filter live in
`src/domen/`, with no database imports, so they can be tested at any fixed date.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in from the Supabase dashboard
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:tz` | The suite under 5 timezones — results must be identical |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed:destinacije` | Idempotent destination seed |
| `npm run db:seed` | Dev fixtures — 2 profiles, 8 reservations |

## The database

One hosted **Supabase** project in the EU serves both development and production.
There is no Docker and no local stack.

Two connection strings, and the difference matters:

- `DATABASE_URL` — transaction pooler, port 6543. Used by the running app.
- `DIRECT_URL` — session pooler, port 5432. Migrations and seeds only, because
  drizzle-kit needs session state that the transaction pooler cannot hold.

**Everything you run touches live data.** `npm run db:reset` drops every table and
is gated behind `POTVRDA="OBRISI SVE"` for that reason. Deleting a reservation in
this app is permanent — there is no status column and no undo.

Drizzle owns the schema. Change `src/db/schema.ts`, run `npx drizzle-kit generate`,
read the SQL, then `npm run db:migrate`.

Destinations are reference data captured from the client's own site into
`data/destinacije.json` — 7 countries, 17 regions, 44 cities. To update them, edit
that file and re-run the destination seed; it inserts, updates and deactivates,
but never deletes.

## Stack

Next.js 16 (App Router, TypeScript strict) · Supabase Postgres + Auth · Drizzle ·
Tailwind v4 · shadcn/ui · Zod · date-fns · libphonenumber-js · Serwist ·
deployed on Vercel.
