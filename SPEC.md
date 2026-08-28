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
| Departure passed, **no return date** | No main date → **drops off the list entirely**. Reachable only by search on the name, or by filtering its past departure date. Accepted trade. |
| Departure and return on the same day | Appears in both the departures group and the returns group of that day's view. |
| One-way ride *home* (e.g. Greece → Belgrade) | Entered as `destinacija = Beograd`, no return date. Works unchanged — see §5. |

---

## 2. Two ways of looking at the list

A date filter is a question about a **day**, not about a booking. So the list
behaves differently depending on whether a date filter is on.

**Raspored** *(no date filter — default)*
One row per reservation, showing its main leg, from today forward. Sorted by main
date ascending. Answers *"what is coming up."*

**Dan** *(date filter active)*
Every leg falling inside the chosen date or range — **departures first, then
returns**. Answers *"what happens on 01.01.2026."*

### Sorting inside a day

No times are stored, so same-day order needs an explicit rule or rows shuffle
between renders. Order is:

1. Departures before returns
2. Destination A–Z
3. Name A–Z

Stable on every render.

---

## 3. Filter, sort, search

- **Datum** — quick chips (*danas · ova nedelja · ovaj mesec*) plus a custom range picker.
- **Destinacija** — checkboxes over the destination reference data (§5), grouped by
  country. Ticking a country matches every destination in it; ticking a region
  matches every city in it. **One canonical list** — see §5.
- Multiple destinations **OR** together; date and destination **AND** together.
  Both can be active at once.
- Filters live in a bottom sheet with a badge showing how many are active, plus *Obriši sve*.
- **Sort** — by date or destination, ascending or descending.
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

Plus a `profiles` table: `id`, `ime`, `email`, `password_hash`, `boja` (badge colour),
and a `destinacije` reference table — see §5.

Dates are stored as plain calendar dates, **no time component**.
**Deleting is permanent** — a confirm dialog is the only guard.

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

**7 countries · 17 regions · 44 cities.**

The third level matters for dispatch. "Kasandra" is a peninsula with six towns —
dropping a family at Hanioti versus Siviri is a forty-minute difference. The
region alone does not tell the driver where to go.

So the form has **three cascading dropdowns**: Država → Regija → Grad. Where a
region contains **exactly one city**, the third dropdown auto-selects and is
hidden — currently Zagreb, Trst, Kopaonik, Skoplje, Ohrid, Sarajevo, Jahorina,
Paralija, Karlovac and Beograd. Implement the rule, not that list: the client
edits their own site, so the set changes when the data is re-seeded.

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

It is added manually to the seed data, marked `"izvor": "rucno"`. Any other
Serbian pickup town the owner needs gets added the same way.

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
sets of dropdowns.

---

## 6. Ekrani

1. **Lista** — sticky header with search, filter and sort. Cards grouped under date
   headings (*danas · sutra · subota, 12.09.*), each carrying a direction chip,
   destination, passenger count and the badge of whoever booked it.
2. **Filter** — bottom sheet, date chips and the destination checkbox list grouped
   by country (collapsible), *Primeni* / *Obriši sve*.
3. **Nova / Izmeni rezervaciju** — one column, big touch targets, native date
   pickers, three cascading destination dropdowns (Država → Regija → Grad) for
   each leg. ⇅ swap button between the two legs.
4. **Detalji** — full booking with *Pozovi* and *WhatsApp* straight off the phone
   number, plus edit and delete.

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
| Trip shape | Return leg **optional** | — |
| Time of day | Dates only, **no times** | Departure times live in his head. Column drops in later without touching anything else. |
| Home destination | Default town in settings, pre-fills, editable | — |
| Departed, no return date | **Drops off the list**, findable by search | Possible to forget someone who is abroad. |
| Language | Serbian, **Latin script** | — |
| Delete | **Permanent**, confirm dialog only | No undo, no recycle bin. Backups are the only net. |
| Destinations | **Reference data** from eurotravel.rs, three cascading dropdowns | Cannot book a destination the client does not serve without re-seeding. |
| Destination filter | **One canonical list**, grouped by country only | — |
| Accounts | Created by the developer, not self-registration | — |

---

## 9. Stack

| Layer | Pick |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Database | **Supabase** Postgres, EU (Frankfurt) |
| ORM / migrations | Drizzle + drizzle-kit — owns the schema |
| Auth | **Supabase Auth**, email/password, cookie sessions via `@supabase/ssr` |
| Access control | **RLS policies**, written in migrations — the real security boundary |
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

### Two free-tier caveats that matter here

**Projects pause after 7 days of inactivity.** For a seasonal transport business a
quiet week in winter would take the app offline until someone unpauses it.

**The free tier has no daily backups**, and deleting a reservation in this app is
permanent.

Both are solved by one nightly GitHub Action that runs `pg_dump` against the
direct connection: it produces a real backup **and** the daily query counts as
activity, so the project never pauses. This is a Phase 8 deliverable, not optional.

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

- [x] ~~Account credentials~~ — accounts are created by the developer via the seed
      script. No self-registration.
- [x] ~~Number of dropdown levels~~ — **confirmed three**: Država → Regija → Grad,
      with the third auto-selected and hidden for single-city regions.
- [x] ~~Default home destination for Podešavanja~~ — confirmed `Srbija › Beograd › Beograd`
- [ ] Should inactive countries (Slovenija, BiH) be bookable anyway? Spec says no —
      hidden from new bookings, still resolvable for old ones.
- [ ] Re-check `data/destinacije.json` against the live site before launch — captured
      27.08.2026, and the client edits their own site.
