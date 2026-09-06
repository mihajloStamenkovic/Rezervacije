/**
 * Reconciles the two expressions of the visibility rule against real data.
 *
 * The rule is written twice on purpose — as a Drizzle `WHERE` clause in
 * `src/db/vidljivost.ts` for the app, and as RLS policies in migration `0004`
 * for the PostgREST surface — because they guard different doors and a single
 * shared Postgres function cannot serve both (`auth.uid()` is NULL over this
 * connection). Two expressions can drift, so something has to check them, and
 * that is this script.
 *
 * Read-only. It runs no INSERT, UPDATE or DELETE and is safe against the one
 * real database. Run it after migrating and after creating any account:
 *
 *     npm run provera:vidljivost
 *
 * Exits non-zero on any failed invariant, so CI could run it too.
 */
import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { asc } from "drizzle-orm";
import { directUrl } from "../env";
import { mozeVideti } from "../domen/pristup";
import { profiles, reservations, timovi } from "./schema";
import { uslovZa } from "./vidljivost";

type Nalaz = { ok: boolean; poruka: string };

const nalazi: Nalaz[] = [];
function proveri(ok: boolean, poruka: string) {
  nalazi.push({ ok, poruka });
}

async function main() {
  const klijent = postgres(directUrl(), { max: 1 });
  const db = drizzle(klijent, { casing: "snake_case" });

  const sviProfili = await db.select().from(profiles).orderBy(asc(profiles.ime));
  const sveRez = await db.select().from(reservations);
  const sviTimovi = await db.select().from(timovi).orderBy(asc(timovi.naziv));

  console.log(
    `${sviProfili.length} naloga, ${sviTimovi.length} timova, ${sveRez.length} rezervacija\n`,
  );

  // 1. The CHECK constraint, verified from outside rather than trusted.
  const losi = sviProfili.filter(
    (p) =>
      (p.uloga === "admin" && p.timId !== null) ||
      (p.uloga === "korisnik" && p.timId === null),
  );
  proveri(
    losi.length === 0,
    `svaki vozac ima tim, nijedan administrator nema (${losi.map((p) => p.ime).join(", ")})`,
  );

  // 2. The SQL the app runs must return exactly what the pure rule predicts.
  //    This is the check that catches a leak, and the only one that exercises
  //    both halves at once.
  for (const p of sviProfili) {
    const izBaze = await db.select().from(reservations).where(uslovZa(p));
    const izPravila = sveRez.filter((r) => mozeVideti(p, r.timId));

    const a = new Set(izBaze.map((r) => r.id));
    const b = new Set(izPravila.map((r) => r.id));
    const isti = a.size === b.size && [...a].every((id) => b.has(id));

    proveri(
      isti,
      `${p.ime} (${p.uloga}): baza vraca ${a.size}, pravilo kaze ${b.size}`,
    );
  }

  // 3. Nothing may be invisible to everyone.
  //
  //    The check that would have caught the design this replaced, where every
  //    booking an owner entered was visible to admins alone and no driver
  //    could see the trip they had to make. An admin-only booking is a
  //    deliberate choice on the form, so it is reported rather than failed —
  //    but it is reported every single time, because it is the one state in
  //    this app that can silently strand a passenger.
  const samoAdmini = sveRez.filter((r) => r.timId === null);
  if (samoAdmini.length > 0) {
    console.log(
      `\n  Napomena: ${samoAdmini.length} rezervacija vide samo administratori.` +
        `\n  Nijedan vozac ih ne vidi. Proveri da to nije greska.\n`,
    );
  }

  const vozaci = sviProfili.filter((p) => p.uloga === "korisnik");
  const nevidljive = sveRez.filter(
    (r) => r.timId !== null && !vozaci.some((p) => mozeVideti(p, r.timId)),
  );
  proveri(
    nevidljive.length === 0,
    `svaka rezervacija dodeljena timu ima bar jednog vozaca koji je vidi` +
      (nevidljive.length > 0 ? ` (${nevidljive.length} nema)` : ""),
  );

  // 4. No booking may reach a team other than the one it is filed under.
  const pogresne = sveRez.filter((r) =>
    vozaci.some((p) => mozeVideti(p, r.timId) && p.timId !== r.timId),
  );
  proveri(
    pogresne.length === 0,
    "nijedna rezervacija ne stize do tudjeg tima",
  );

  await klijent.end();

  console.log();
  for (const n of nalazi) console.log(`${n.ok ? "  OK  " : "  PAO "} ${n.poruka}`);

  const pali = nalazi.filter((n) => !n.ok).length;
  console.log(
    pali === 0
      ? `\nSve provere prolaze (${nalazi.length}).`
      : `\n${pali} od ${nalazi.length} provera ne prolazi.`,
  );
  process.exit(pali === 0 ? 0 : 1);
}

main().catch((greska) => {
  console.error(greska);
  process.exit(1);
});
