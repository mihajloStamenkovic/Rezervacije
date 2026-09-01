/**
 * Development seed — two profiles, the default home town, and a set of
 * reservations chosen to be awkward rather than representative.
 *
 * Every date is relative to today in Belgrade, so the fixtures keep meaning
 * the same thing next month: "departed yesterday" stays departed.
 *
 * Idempotent: it deletes the reservations it created (by fixed id) and writes
 * them again. It never touches `destinacije`.
 *
 * Run with `npm run db:seed` — after `db:migrate` and `db:seed:destinacije`.
 */
import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import { directUrl } from "../env";
import { danasBeograd, pomeriDane } from "../lib/datum";
import { destinacije, reservations, settings } from "./schema";

/**
 * The two real Supabase Auth accounts (`auth.users.id`), fixed since the
 * accounts are created once in the dashboard, never by this script.
 * `profiles.id` is a real foreign key to `auth.users.id` as of migration
 * `0002`, so these must be real auth ids, not placeholders.
 */
const PROFIL_MIHAJLO = "56231ad7-e99a-4425-ae45-f87a82b2c07d";
const PROFIL_PETAR = "22ecbb36-23fd-4d78-905d-fb8f0d2c89ca";

const REZ = (n: number) =>
  `00000000-0000-4000-8000-1000000000${String(n).padStart(2, "0")}`;

type Db = ReturnType<typeof drizzle>;

async function destinacijaId(db: Db, drzavaSifra: string, grad: string) {
  const [red] = await db
    .select({ id: destinacije.id })
    .from(destinacije)
    .where(
      and(eq(destinacije.drzavaSifra, drzavaSifra), eq(destinacije.grad, grad)),
    )
    .limit(1);
  if (!red) {
    throw new Error(
      `Destinacija ${drzavaSifra}/${grad} ne postoji. ` +
        `Pokreni prvo: npm run db:seed:destinacije`,
    );
  }
  return red.id;
}

/**
 * Upserts a `profiles` row, reading `email` from `auth.users` rather than
 * accepting it as a parameter — `profiles.id` is a real foreign key to
 * `auth.users.id` (migration `0002`), so the row must not exist otherwise,
 * and the email must never be a literal in this file (see module comment).
 */
async function upisiProfil(db: Db, id: string, ime: string, boja: string) {
  const [red] = await db.execute(sql`
    insert into profiles (id, ime, email, boja)
    select id, ${ime}, email, ${boja}
    from auth.users
    where id = ${id}
    on conflict (id) do update set
      ime = excluded.ime,
      email = excluded.email,
      boja = excluded.boja
    returning id
  `);
  if (!red) {
    throw new Error(
      `Nalog ${ime} (${id}) ne postoji u auth.users. ` +
        `Nalog se pravi u Supabase dashboard-u, ne ovim skriptom.`,
    );
  }
}

async function main() {
  const client = postgres(directUrl(), { max: 1 });
  const db = drizzle(client);
  const danas = danasBeograd();

  try {
    // Email is copied from auth.users with `insert ... select`, never
    // written as a literal — this file is committed to a public repo and
    // both addresses are the account holders' own personal addresses
    // (see migration 0002, which does the same thing for the same reason).
    await upisiProfil(db, PROFIL_MIHAJLO, "Mihajlo", "#2563eb");
    await upisiProfil(db, PROFIL_PETAR, "Petar", "#d97706");

    const beograd = await destinacijaId(db, "srbija", "Beograd");
    const hanioti = await destinacijaId(db, "grcka", "Hanioti");
    const siviri = await destinacijaId(db, "grcka", "Siviri");
    const solun = await destinacijaId(db, "grcka", "Solun");
    const zagreb = await destinacijaId(db, "hrvatska", "Zagreb");
    const kopaonik = await destinacijaId(db, "srbija", "Kopaonik");
    const ljubljana = await destinacijaId(db, "slovenija", "Ljubljana");

    // Podešavanja: the default home town (SPEC §6).
    await db
      .insert(settings)
      .values({ id: 1, podrazumevanaDestinacijaId: beograd })
      .onConflictDoUpdate({
        target: settings.id,
        set: { podrazumevanaDestinacijaId: beograd },
      });

    const redovi = [
      {
        // The worked example from SPEC §1, anchored to today so it stays future.
        id: REZ(1),
        ime: "Marko Petrović",
        telefon: "+381641234567",
        destinacijaId: hanioti,
        datumPolaska: pomeriDane(danas, 14),
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 28),
        brojPutnika: 4,
        kreirao: PROFIL_MIHAJLO,
      },
      {
        // Departing TODAY — proves the `>=` boundary resolves to ↑ Odlazak.
        id: REZ(2),
        ime: "Jelena Ilić",
        telefon: "+381631112233",
        destinacijaId: solun,
        datumPolaska: danas,
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 7),
        brojPutnika: 2,
        kreirao: PROFIL_PETAR,
      },
      {
        // Departed, return still ahead — must show as ↓ Povratak to Beograd,
        // and must NOT match the Grčka destination filter any more.
        id: REZ(3),
        ime: "Porodica Jovanović",
        telefon: "+381652223344",
        destinacijaId: siviri,
        datumPolaska: pomeriDane(danas, -5),
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 9),
        brojPutnika: 5,
        kreirao: PROFIL_MIHAJLO,
      },
      {
        // Departed, NO return date — has no main date, so it drops off the
        // list entirely and is reachable only by search (SPEC §1, edge cases).
        id: REZ(4),
        ime: "Stefan Nikolić",
        telefon: "+381603334455",
        destinacijaId: zagreb,
        datumPolaska: pomeriDane(danas, -3),
        destinacijaPovratkaId: beograd,
        datumPovratka: null,
        brojPutnika: 1,
        kreirao: PROFIL_PETAR,
      },
      {
        // One-way ride HOME: Greece → Belgrade, Beograd in the OUTBOUND column.
        // The Beograd filter must catch this one and #1 alike (SPEC §5).
        id: REZ(5),
        ime: "Ana Marković",
        telefon: "+381644445566",
        destinacijaId: beograd,
        datumPolaska: pomeriDane(danas, 3),
        destinacijaPovratkaId: beograd,
        datumPovratka: null,
        brojPutnika: 3,
        kreirao: PROFIL_MIHAJLO,
      },
      {
        // Same-day round trip — appears in BOTH groups of that day's view.
        id: REZ(6),
        ime: "Dragan Đorđević",
        telefon: "+381665556677",
        destinacijaId: kopaonik,
        datumPolaska: pomeriDane(danas, 2),
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 2),
        brojPutnika: 21,
        kreirao: PROFIL_PETAR,
      },
      {
        // Points at an INACTIVE destination (Slovenija). Must still render.
        id: REZ(7),
        ime: "Šaban Šaulić",
        telefon: "+381667778899",
        destinacijaId: ljubljana,
        datumPolaska: pomeriDane(danas, 10),
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 12),
        brojPutnika: 2,
        kreirao: PROFIL_MIHAJLO,
      },
      {
        // Same main date as #6, different destination — exercises the
        // destination A–Z then name A–Z tiebreak (SPEC §2).
        id: REZ(8),
        ime: "Aleksandar Cvetković",
        telefon: "+381628889900",
        destinacijaId: hanioti,
        datumPolaska: pomeriDane(danas, 2),
        destinacijaPovratkaId: beograd,
        datumPovratka: pomeriDane(danas, 16),
        brojPutnika: 6,
        kreirao: PROFIL_PETAR,
      },
    ];

    const ids = redovi.map((r) => r.id);
    await db.delete(reservations).where(inArray(reservations.id, ids));
    await db.insert(reservations).values(redovi);

    console.log(
      `Seed: 2 profila, podrazumevano mesto = Beograd, ` +
        `${redovi.length} rezervacija (danas = ${danas}).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
