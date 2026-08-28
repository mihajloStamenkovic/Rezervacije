# What I need from you

Stack: **Supabase** (Postgres + Auth) · **Vercel** (hosting) · **GitHub** (repo + CI).
Organised by **when** it's needed.

---

## Already sorted ✅

| Item | Status |
|---|---|
| Node v22.18.0 | installed |
| npm 11.18.0 | installed |
| git 2.52.0 | installed |
| psql 18.3 | installed — needed for backups |
| GitHub repo | `github.com/mihajloStamenkovic/Rezervacije` |
| Supabase project | created, EU (Frankfurt), `eu-central-1` |
| `.env.local` | filled in and working — migrations applied, data seeded |

**Block A is done.** The database is live: 44 destinations, 2 placeholder profiles,
8 test reservations, and RLS enabled on every table.

There is **no Docker and no local Supabase stack**. Development runs against the
hosted project directly — one database, serving both dev and production. That is
simpler, it is what the app will actually use, and it is the only way to test auth
and RLS honestly.

The trade: **everything you or I run touches live data.** `npm run db:reset` is
gated behind a confirmation phrase, and deleting a reservation is permanent. This
is why the nightly backup job in Block C is not optional.

---

## BLOCK A — done ✅

### A1. Default home destination

- [x] **Confirmed `Srbija › Beograd › Beograd`** (28.08.2026)

The seed already writes it into the `settings` row on that assumption. It is the
destination pre-filled into the return leg of every new booking, and it is what a
one-way ride home points at.

---

## BLOCK B — before Phase 4 (auth)

### B1. Create the two accounts

In Supabase → Authentication → Users → **Add user**. You set the passwords right
there, in their dashboard.

- [ ] Account 1 — email + password
- [ ] Account 2 — email + password

⚠️ **Do not send me the passwords.** There is no seed script and no env var for
them — the passwords exist only in Supabase's own auth tables. I never touch them
at any point.

The emails are the logins. They don't need to be real or receive mail.

Once they exist, send me the two user **ids** (visible in the dashboard). The seed
currently uses placeholder UUIDs and needs the real ones.

### B2. Display names and badge colours

- [ ] Name for each account (shows on the reservation badge — e.g. `Nikola`)
- [ ] Badge colours, or let me pick two distinguishable ones

Send me these two — they're not secrets.

---

## BLOCK C — before Phase 8 (deploy)

### C1. Vercel account

- [ ] Sign up at vercel.com — **use "Continue with GitHub"**
- [ ] Import the `Rezervacije` repo
- [ ] Authorise the GitHub connection (an OAuth grant — has to be you)

**Free** on the Hobby plan. This app is nowhere near its limits.

Note: the repo currently has **zero commits**. I'll commit and push before this
step — Vercel builds from GitHub, so there needs to be something there.

### C2. Sentry (optional, recommended)

- [ ] Sign up at sentry.io, free tier, platform **Next.js**
- [ ] Give me the DSN, or add it to Vercel's env vars yourself

A Sentry DSN ships in the client bundle by design, so it isn't a secret the way a
key is. Worth having: the owner won't file a bug report, he'll say "it didn't
work" three days later.

### C3. Backup destination

The nightly `pg_dump` job needs somewhere to put dumps.

- [ ] **Option 1 (default):** GitHub Actions artifacts, 90-day retention. Zero setup.
- [ ] **Option 2:** a private `Rezervacije-backups` repo. Longer history, still free.
- [ ] **Option 3:** an S3/R2 bucket. Best, but needs credentials.

Tell me which. **Option 1 unless you have a preference.**

### C4. Domain (optional, skip for now)

Vercel gives `something.vercel.app` free. Once it's an icon on his home screen
nobody types the URL. ~€10/year later if you want it to feel finished.

---

## Environment variables — the full list

### `.env.local` (development, git-ignored)

All five are already set and working.

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → API. The bare project root — no `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same page — `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` ⚠️ | same page — `sb_secret_…`, bypasses RLS, server only |
| `DATABASE_URL` | Database → Connection string, **transaction** pooler, port 6543 |
| `DIRECT_URL` | same, **session** pooler, port 5432 |

Supabase renamed its keys: `anon` → publishable, `service_role` → secret. This
project uses the new names only. If you see `ANON_KEY` or `SERVICE_ROLE_KEY`
anywhere, it's stale.

`DIRECT_URL` must **not** use `db.<project-ref>.supabase.co` — newer projects don't
publish that host on IPv4 and it fails with `ENOTFOUND`. The session pooler on port
5432 is the supported replacement and is what's configured.

### Vercel (production)

The same five, plus `SENTRY_DSN`. Same project, same values.

### GitHub Actions secrets

| Secret | Why |
|---|---|
| `SUPABASE_DB_URL` | session-pooler connection, for the nightly `pg_dump` |

**No `AUTH_SECRET`.** Supabase issues and rotates its own JWTs.

---

## Things I cannot do — these are yours

1. **Create accounts.** Supabase, Vercel, Sentry.
2. **Enter passwords.** Including the two app accounts — create them in Supabase's
   dashboard and don't send them to me.
3. **Click through OAuth grants.** Vercel ↔ GitHub.
4. **Run interactive logins.** `vercel login` — prefix with `!` in the session so
   the output lands in our conversation.

Everything else — scaffold, schema, RLS policies, migrations, code, tests, CI,
backup job, deploy config — I do.

---

## Two free-tier caveats worth knowing

Supabase pauses free projects after **7 days of inactivity**, and provides **no
managed daily backups**. For a seasonal transport business, a quiet week in winter
would take the app offline — and deletion in this app is permanent.

One nightly GitHub Action fixes both: `pg_dump` produces a real backup, and the
daily query counts as activity so the project never pauses. It's a Phase 8
deliverable, not optional. It matters more here than it would elsewhere, because
dev and production are the same database.

If the owner ever wants managed backups and no pause risk, that's Supabase Pro at
$25/month. Not needed to launch.

---

## Summary: what's outstanding

**Block A is complete.** Nothing is outstanding from you right now, and Phase 3 —
the main-leg engine — is unblocked.

**Block B** when we reach auth: two accounts created in the dashboard, their user
ids, names and badge colours.

**Block C** when we're ready to ship: Vercel, optionally Sentry, and a backup
destination.
