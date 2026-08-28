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
import { destinacije, profiles, reservations, settings } from "./schema";

/**
 * Fixed ids so re-running replaces rather than duplicates.
 *
 * The profile ids are placeholders. Phase 4 ties `profiles.id` to
 * `auth.users.id`; until then these are just two rows to hang `kreirao` on.
 */
const PROFIL_A = "00000000-0000-4000-8000-000000000001";
const PROFIL_B = "00000000-0000-4000-8000-000000000002";

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

async function main() {
  const client = postgres(directUrl(), { max: 1 });
  const db = drizzle(client);
  const danas = danasBeograd();

  try {
    await db
      .insert(profiles)
      .values([
        { id: PROFIL_A, ime: "Nikola", email: "nikola@example.test", boja: "#2563eb" },
        { id: PROFIL_B, ime: "Marija", email: "marija@example.test", boja: "#d97706" },
      ])
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ime: sql`excluded.ime`,
          email: sql`excluded.email`,
          boja: sql`excluded.boja`,
        },
      });

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
        kreirao: PROFIL_A,
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
        kreirao: PROFIL_B,
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
        kreirao: PROFIL_A,
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
        kreirao: PROFIL_B,
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
        kreirao: PROFIL_A,
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
        kreirao: PROFIL_B,
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
        kreirao: PROFIL_A,
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
        kreirao: PROFIL_B,
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
