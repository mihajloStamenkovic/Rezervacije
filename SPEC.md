# Kombi Rezervacije — Specifikacija v1

A shared reservation book for a two-person van transport business. One list, two
accounts, both see everything. Mobile-first — it lives on a phone.

|  |  |
|---|---|
| Accounts | 2 (fixed, no self-registration) |
| Table columns | 9 |
| Screens | 4 + settings |
| UI language | Serbian, Latin script |
| Timezone | Europe/Belgrade (fixed, not device) |

---

## 1. The main leg rule

The idea the whole app turns on. Every reservation has two legs — going out and
coming home — but only ever **one main date**, and which leg that is depends on
today.

| Condition | Main date | Main destination | Direction |
|---|---|---|---|
| Departure has not passed | `datum_polaska` | trip destination | ↑ Odlazak |
| Departure has passed | `datum_povratka` | home | ↓ Povratak |

The same rule applies to every reservation, so the list always has a single
consistent thing to sort by. A booking flips the day after it departs — it stops
being a trip *to* Greece and becomes a homecoming *to* Belgrade.

### Worked example

Booking: Marko Petrović, 4 putnika, Grčka, polazak 01.01.2026, povratak 15.01.2026.

- **On 20.12.2025** → main date `01.01.2026`, main destination `Grčka`, chip ↑ Odlazak.
  Matches the Greece destination filter.
- **On 05.01.2026** → main date `15.01.2026`, main destination `Beograd`, chip ↓ Povratak.
  No longer matches the Greece filter.

Same row in the database. Only today's date changed.

### Edge cases

| Case | Behaviour |
|---|---|
| Departure passed, **no return date** | No main date → **drops off the list entirely**. Reachable two ways: by search on the name, or by filtering its past departure date. Accepted trade — reaffirmed 01.09.2026, see §8. |
| Departure and return on the same day | Appears in both the departures group and the returns group of that day's view — two rows for one booking. |
| One-way ride *home* (e.g. Greece → Belgrade) | Entered with the **Jednosmerna vožnja** option: *Odakle* = Solun, *Kuda* = Beograd, no return date. See §5. |

---

## 2. Three ways of looking at the list

A date filter is a question about a **day**, not about a booking. So the list
behaves differently depending on whether a date filter is on.

**Raspored** *(no date filter — default)*
One row per reservation, showing its main leg, from today forward. Sorted by main
date ascending. Answers *"what is coming up."*

**Dan** *(date filter active)*
Every leg falling inside the chosen date or range — **departures first, then
returns**. Answers *"what happens on 01.01.2026."* Neither the main leg rule
nor the "from today forward" horizon applies here, which is what makes a past
departure date reach a booking that has no main date (§1).

**Pretraga** *(search active, no date filter)*
One row per matching reservation, with no date horizon. Needed because §3 makes
search the only way to reach a booking with no main date, and such a booking
has no main leg for either mode above to render — it shows its departure leg
instead. Added 28.08.2026 during implementation; this paragraph is the spec
catching up with it.

### Sorting inside a day

No times are stored, so same-day order needs an explicit rule or rows shuffle
between renders. Order is:

1. Departures before returns
2. Destination A–Z
3. Name A–Z
4. Reservation id, so the order never depends on what order Postgres returned

Stable on every render.

Day headings follow the **date** sort. Sorted by destination the dates are
scattered, so the list goes flat and each card carries its own date instead —
grouping by day there would produce a column of one-row groups.

---

## 3. Filter, sort, search

- **Datum** — quick chips (*danas · ova nedelja · ovaj mesec*) plus a custom range picker.
- **Destinacija** — checkboxes over the destination reference data (§5), grouped by
  country. Ticking a country matches every destination in it; ticking a region
  matches every city in it. **One canonical list** — see §5.
- Multiple destinations **OR** together; date and destination **AND** together.
  Both can be active at once.
- Filters live in a bottom sheet with a badge showing how many are active, plus *Obriši sve*.
- **Sort** — by date or destination, ascending or descending. Lives in the same
  bottom sheet as the filters; two toggles do not deserve a second sheet.
- **Pretraga** over name, phone and destination. Often faster than filtering, and it
  is the only way to reach a booking that has no main date.

---

## 4. Model podataka

Nine columns. No status, no notes, no timestamps.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid | primary key |
| `ime` | text | Booking name — one name covers the whole group |
| `telefon` | text | Normalized to `+381…` on save so it dials from abroad |
| `destinacija_id` | → destinacije | Trip destination, chosen from dropdowns (§5) |
| `datum_polaska` | date | Required |
| `destinacija_povratka_id` | → destinacije | Pre-filled from default home destination, editable |
| `datum_povratka` | date | Optional — filled in later when confirmed |
| `broj_putnika` | int | Displays as *"4 putnika"* |
| `kreirao` | → profiles | Which of the two accounts entered it |

Plus a `profiles` table: `id`, `ime`, `email`, `boja` (badge colour), and a
`destinacije` reference table — see §5.

**There is no `password_hash`, deliberately.** Supabase Auth (§9) owns
credentials in `auth.users`, where they are hashed, salted and rate-limited. A
second copy in `public` would be a source of truth that can disagree with the
first, in a schema reachable over PostgREST. `profiles` is the **access list**,
not a credential store — see §9.

### There is no origin column, and that is a real limit

A booking stores where they are **going** and where they come **back to**. It
does not store where they set out **from**. The app infers it: the far end of a
leg is the *other* destination column, chosen by direction. That is exact while
origin and return-destination are the same place, which is true for a
Belgrade-based van and for the *Jednosmerna vožnja* option in §5.

It cannot express a trip with **three** distinct places — pick up in Niš, drive
to Grčka, return them to Beograd. That needs a tenth column and is not in v1.

Dates are stored as plain calendar dates, **no time component**.
**Deleting is permanent** — a confirm dialog is the only guard, and the nightly
backup (§9) is the only net.

---

## 5. Destinations — reference data from eurotravel.rs

Destinations are **not free text**. They come from a fixed reference table seeded
from the client's own site, and the owner picks them from dropdowns.

Source: `https://eurotravel.rs/destinacije`, captured 27.08.2026 into
[`data/destinacije.json`](./data/destinacije.json).

### The data is three levels, not two

| Level | Example |
|---|---|
| Država | Grčka |
| Regija | Kasandra |
| Grad | Hanioti |

**7 countries · 18 regions · 45 cities.** 44 captured from the client's site
(Beograd among them, added by hand), plus Niš.

The third level matters for dispatch. "Kasandra" is a peninsula with six towns —
dropping a family at Hanioti versus Siviri is a forty-minute difference. The
region alone does not tell the driver where to go.

So the form has **three cascading dropdowns**: Država → Regija → Grad. Where a
region contains **exactly one city**, the third dropdown auto-selects and is
hidden. That set was ten regions when this was written and is 33 now that the
Serbian pickup towns are in — which is exactly why the instruction is
**implement the rule, not the list**. Changing country clears region and city.

### The `destinacije` table

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid | primary key |
| `drzava` | text | e.g. `Grčka` |
| `drzava_sifra` | text | e.g. `grcka` — stable key for re-seeding |
| `regija` | text | e.g. `Kasandra` |
| `grad` | text | e.g. `Hanioti` |
| `aktivna` | boolean | Offerable for new bookings — see below |
| `redosled` | int | Display order within its country |

One row per **city**. Country and region are denormalized onto it — with 44 rows
total, a three-table join buys nothing and costs clarity.

### Inactive destinations must still resolve

The site currently marks **Slovenija** and **Bosna i Hercegovina** as
*"trenutno nije dostupna u našoj ponudi."*

`aktivna = false` means: **hidden from the new-reservation dropdowns, but still
fully resolvable** for existing reservations and still present in the filter if a
booking references it. Never delete a destination row — a past reservation
pointing at it must keep rendering.

### Beograd is not on the site

Belgrade is the company's *origin*, so it is not listed as a destination. But the
app needs it as the default **return** destination, and for one-way rides home.

It is added manually to the seed data, marked `"izvor": "rucno"`, and it is the
**default return destination** — around 99% of rides start and end there.

**Niš** is added the same way, as the one other pickup point. Serbia therefore
offers exactly three places: `Beograd`, `Kopaonik` (the client's own ski
destination, from their site) and `Niš` — in that order, because `redosled` is
what the dropdown sorts by and Beograd must be first.

> The 23 largest Serbian towns were added on 01.09.2026 and withdrawn the same
> day at the owner's request: two pickup points is what the business actually
> has, and a dropdown of 25 towns costs a scan on every booking to serve a case
> that does not arise. Adding more later is one edit to
> `data/destinacije.json` plus `npm run db:seed:destinacije`.

### A destination is a destination, whichever column it sits in

This is a hard requirement and survives the move to reference data:

> The destination filter is **one canonical list**. A place appears **once** and
> matches bookings that reference it from **either** `destinacija_id` **or**
> `destinacija_povratka_id`.

The owner books one-way rides *home* — Greece → Belgrade — where Belgrade sits in
the outbound field. If the filter split into "trip destinations" and "home towns",
Belgrade would appear as two checkboxes and ticking one would silently miss half
the Belgrade bookings.

Grouping the filter by **country** is fine and encouraged — that is a real
hierarchy in the data. Grouping by **trip-versus-home** is wrong — that is an
artificial split the client's own data disproves.

### Keeping the data current

The client will add destinations to their site. The seed is a re-runnable,
idempotent script keyed on `drzava_sifra` + `regija` + `grad`: it inserts new
rows, updates changed names, and flips `aktivna` — but **never deletes**.

Updating means editing `data/destinacije.json` and re-running the seed. Note this
in `RUNBOOK.md`. There is no admin UI in v1.

### Swap button

The form keeps a **⇅ swap** button between the two destination selections, so
entering a homecoming-first booking is one tap rather than re-navigating both
sets of dropdowns. It exchanges the two *destinations* and leaves the dates
alone — a departure date is a departure date whichever way the van points.

### Jednosmerna vožnja (one-way)

A checkbox on the form. It is **not a tenth column**: a booking with no
`datum_povratka` is already a one-way (§8, "return leg optional"), so the box
makes that absence sayable instead of leaving the owner to infer it from an
empty field.

Ticking it clears and hides the return date, and relabels the second leg from
*Povratak* to **Odakle**, showing it first — "from Solun to Beograd" is the
order it is said out loud. On a one-way that column holds where they set out
from, which on a round trip is home, so this is a reading of the column rather
than a change to it.

Its initial state is set per screen, never inferred from the empty field:
**Nova** opens as a round trip (§4 has the return date filled in later), and
**Izmeni** opens ticked when the stored booking has no return date.

**What the data cannot say:** "this trip is one-way" and "the return is not
confirmed yet" are both an absent `datum_povratka`. Nothing in the app behaves
differently between them, so nothing is lost — but no report can tell them
apart.

---

## 6. Ekrani

1. **Lista** — sticky header with search, filter and sort. Cards grouped under date
   headings (*danas · sutra · subota, 12.09.*), each carrying a direction chip,
   the **route**, passenger count and the badge of whoever booked it.
   The route is both ends of that leg — `Solun → Beograd` on a return,
   `Beograd → Hanioti` on a departure — because "↓ Povratak · Beograd" says
   they are arriving but not where from, which is half the dispatch question.
   Where both ends are the same place it collapses to one name.
2. **Filter** — bottom sheet, date chips and the destination checkbox list grouped
   by country (collapsible), *Primeni* / *Obriši sve*.
3. **Nova / Izmeni rezervaciju** — one column, big touch targets, native date
   pickers, three cascading destination dropdowns (Država → Regija → Grad) for
   each leg. ⇅ swap button between the two legs, and the *Jednosmerna vožnja*
   checkbox (§5).
4. **Detalji** — full booking with *Pozovi* and *WhatsApp* straight off the phone
   number, plus edit and delete. A round trip reads *Polazak / Povratak*; a
   one-way reads **Odakle / Kuda / Povratak nije dogovoren**, so the origin is
   never invisible.

Plus **Podešavanja** — one field: the default home town.

---

## 7. Working from another country

It is a web app on a URL, so it works from anywhere with a connection. Three
things make that actually true rather than nominally true.

1. **One fixed business timezone — Europe/Belgrade.** The whole app hinges on
   "has the departure passed?" Read that from the phone clock and a late night
   in Greece flips bookings a day early, and the two accounts see different lists.

   ```ts
   new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade' }).format(new Date())
   // → "2026-08-27"   (sv-SE emits ISO format natively)
   ```

2. **Phone numbers stored international.** `064 123 4567` will not dial from a
   Greek network. `+381 64 123 4567` dials from anywhere — the form normalizes on save.

3. **Deploy to an EU region** (Frankfurt) to keep it quick across the Balkans and
   Western Europe.

The list is cached, so the app opens and shows the schedule with no signal.
Adding and editing need a connection.

---

## 8. Decisions locked

| Decision | Choice | Trade accepted |
|---|---|---|
| Trip shape | Return leg **optional**, with an explicit *Jednosmerna vožnja* option (§5) | One-way and "return not agreed yet" look identical in the data |
| Time of day | Dates only, **no times** | Departure times live in his head. Column drops in later without touching anything else. |
| Home destination | Default town in settings, pre-fills, editable | — |
| Departed, no return date | **Drops off the list**; findable by search **or** by filtering its past departure date | Possible to forget someone who is abroad. **Reaffirmed 01.09.2026** after seeing it on real data: the owner searches the name and edits, or enters a new booking. Not changing it. |
| Language | Serbian, **Latin script** | — |
| Delete | **Permanent**, confirm dialog only | No undo, no recycle bin. The nightly backup (§9) is the only net — it is not optional, and it now exists. |
| Destinations | **Reference data** from eurotravel.rs, three cascading dropdowns | Cannot book a destination the client does not serve without re-seeding. |
| Destination filter | **One canonical list**, grouped by country only | — |
| Accounts | Created in the Supabase dashboard; `profiles` is the access list (§9) | Adding a person is two steps, and skipping the second locks them out rather than letting them in |
| Pickup towns | **Beograd** (default) and **Niš** only (§5) | Not from the client's site; maintained by hand in `data/destinacije.json`. More are one edit plus a re-seed away |

---

## 9. Stack

| Layer | Pick |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Database | **Supabase** Postgres, EU (Frankfurt) |
| ORM / migrations | Drizzle + drizzle-kit — owns the schema |
| Auth | **Supabase Auth**, email/password, cookie sessions via `@supabase/ssr` |
| Access control | **RLS policies**, written in migrations — the real security boundary. Every policy tests `je_clan()`: a row in `profiles` |
| Styling | Tailwind v4 |
| Components | shadcn/ui — Sheet, Dialog, Input, Button, Checkbox only |
| Validation | Zod, shared client + Server Action |
| Forms | Server Actions + `useActionState` |
| Dates | `date-fns` + `srLatn` locale; `Intl` for the Belgrade "today" |
| Phones | `libphonenumber-js/min`, default country `RS` |
| PWA | `@serwist/next` |

### Services

| Service | Use | Cost |
|---|---|---|
| Supabase | Postgres + Auth, EU (Frankfurt) | Free tier — see caveats |
| Vercel | Next.js hosting, auto-deploy from GitHub | Free (Hobby) |
| GitHub | `mihajloStamenkovic/Rezervacije` — repo, CI, nightly backup job | Free |
| Sentry | Free tier. Know why it broke while he is driving through Greece. | Free |
| Domain | Skip initially; `*.vercel.app` is fine once it is a home screen icon | ~€10/yr |

**Total running cost: €0.**

No email service (no signups, no password reset — reset in the Supabase dashboard).
No analytics (two users).

### Who may enter — `profiles` is the access list

Corrected 01.09.2026. This section previously asserted "no signups" as a fact.
It was not one: signups were **enabled** on the live project, and a stranger who
confirmed an email could have signed in and read — or deleted — every booking,
because the policies then read `USING (true)` for any authenticated user.

Both halves are now closed:

1. **Signups disabled** in the Supabase dashboard.
2. **Membership is the rule in the database.** Migration `0003` adds
   `public.je_clan()` — `SECURITY DEFINER`, so the policy on `profiles` can
   consult `profiles` without infinite recursion — and every policy on all four
   tables tests it. An `auth.users` row with no `profiles` row reads nothing and
   writes nothing.

The app repeats the check where the data is: `prijaviSe` revokes the session it
just minted if the account has no profile, and `src/proxy.ts` counts "logged in"
as *session **and** profile*, so a stray account is turned away rather than
bounced between `/` and `/prijava` forever.

Adding a person is two steps — create the account in the dashboard, then insert
their `profiles` row. Removing one is a single row delete. See `RUNBOOK.md`.

> **Why the app checks at all, when RLS is the boundary:** the screens read
> through Drizzle, which connects as the table owner and *bypasses RLS*. For a
> REST call with the publishable key RLS holds; for a server render it is not in
> the path at all. So the check is repeated in `zahtevajKorisnika()`.

### Two free-tier caveats that matter here

**Projects pause after 7 days of inactivity.** For a seasonal transport business a
quiet week in winter would take the app offline until someone unpauses it.

**The free tier has no daily backups**, and deleting a reservation in this app is
permanent.

Both are solved by one nightly GitHub Action that runs `pg_dump` against the
direct connection: it produces a real backup **and** the daily query counts as
activity, so the project never pauses.

**Built 01.09.2026** — `.github/workflows/rezerva.yml`, nightly at 01:30 UTC.
It installs `pg_dump` 17 (the server is 17.6 and the runner ships 16, which
refuses), dumps the `public` schema only — never `auth`, so a backup can never
leak password hashes — writes a human-readable CSV of every booking, and commits
both to the orphan branch `rezerve`, where nothing expires. It refuses to commit
a dump that is missing tables or suspiciously small, because a backup that
silently contains nothing is worse than none.

A restore was **performed and verified**, not merely enabled: the dump was
replayed into a scratch schema inside a transaction and rolled back, returning
44 destinacije, 2 profila, 8 rezervacija and 1 settings row. Procedure in
`RUNBOOK.md`.

If the owner later wants managed backups and no pause risk, that is Supabase Pro
at $25/month. Not needed to launch.

### Deliberately not using

Prisma (query-engine binary bloats the image) · MUI/Chakra (too much CSS for a
phone) · Redux/Zustand (server components hold the state) · tRPC (Server Actions
cover every call) · Auth.js / bcrypt / Lucia (Supabase owns auth) · Supabase
Realtime (nice for live updates between the two accounts — v2, not v1).

---

## 10. Not in v1

Cene i naplata · Vozila i vozači · Ponavljajuće ture · SMS podsetnici ·
Izvoz u kalendar · Imena pojedinačnih putnika · Vreme polaska · Istorija izmena

All of it drops onto this schema later without a rewrite.

---

## 11. Open items

- [x] ~~Account credentials~~ — created in the Supabase dashboard; `profiles` is
      the access list (§9). No self-registration, and signups are disabled.
- [x] ~~Number of dropdown levels~~ — **confirmed three**: Država → Regija → Grad,
      with the third auto-selected and hidden for single-city regions.
- [x] ~~Default home destination for Podešavanja~~ — confirmed `Srbija › Beograd › Beograd`
- [x] ~~Should inactive countries (Slovenija, BiH) be bookable anyway?~~ — **no.**
      Hidden from the new-booking dropdowns, still fully resolvable on existing
      bookings, and still in the filter for as long as a booking references one.
- [x] ~~`password_hash` on `profiles`~~ — **dropped.** Supabase Auth owns
      credentials; see §4 and §9.
- [x] ~~Backups~~ — nightly `pg_dump` built and a restore verified (§9).
- [ ] Re-check `data/destinacije.json` against the live site before launch — the
      Greek, Croatian and other entries were captured 27.08.2026 and the client
      edits their own site. Beograd and Niš are ours and need no check.
- [ ] **A trip with three distinct places** — pick up in Niš, drive to Grčka,
      return to Beograd — cannot be expressed (§4). Needs a tenth column. Not
      in v1; revisit if the owner starts running pickups he does not return to.

---

## 12. Changelog

**01.09.2026** — this document was brought back in line with the code after
Phases 3–5. It had drifted in six places, and one of them was a security
property (§9) asserted as fact that was not true. Changes: three list modes
(§2), no `password_hash` and no origin column (§4), 45 destinations with Beograd
and Niš as the two Serbian pickup points (§5), the *Jednosmerna vožnja* option
(§5), route on the cards (§6), `profiles` as the access list and backups built
and restore-verified (§9).

**Standing rule:** if the code and this file disagree, that is a bug in one of
them — report it rather than quietly following whichever is nearer.
