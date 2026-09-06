/**
 * Rehearses a migration inside a transaction that is always rolled back.
 *
 * There is one database and it is the real one, so the interesting question
 * about migration `0004` cannot be answered by reading it: do the two CHECK
 * constraints accept the rows that are actually in `profiles` right now? A
 * constraint that rejects existing data fails the migration halfway through,
 * and finding that out during `npm run db:migrate` is finding it out in the
 * worst place.
 *
 * This applies the file, asserts against the result, and then **rolls back**.
 * Nothing it does survives. Run it before `npm run db:migrate`:
 *
 *     npm run proba:migracije
 *
 * `postgres.js` rolls the transaction back automatically if the callback
 * throws, and the callback throws on purpose at the end — so there is no path
 * through this file that commits.
 */
import "./env";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { directUrl } from "../env";

const PUTANJA = "drizzle/0004_timovi_i_uloge.sql";

/** Thrown to force the rollback. Caught below and reported as success. */
const GOTOVO = Symbol("proba gotova");

async function main() {
  const sql = postgres(directUrl(), { max: 1 });

  // The migrator splits on this marker; applying the file as one script would
  // work too, but splitting is what production actually does.
  //
  // The "is this chunk only comments" test is a line scan and not a regex, and
  // that is not a style choice. It was `/^(--[^\n]*\n?)*$/`, which is a nested
  // quantifier whose inner branch can match empty — catastrophic backtracking.
  // Against this file's comment blocks it never returned, and it looked exactly
  // like a database lock: a migration script that hangs having printed nothing.
  const samoKomentar = (s: string) =>
    s.split("\n").every((r) => {
      const t = r.trim();
      return t === "" || t.startsWith("--");
    });

  const naredbe = readFileSync(PUTANJA, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !samoKomentar(s));

  console.log(`${PUTANJA}: ${naredbe.length} naredbi\n`);

  try {
    await sql.begin(async (tx) => {
      for (const [i, naredba] of naredbe.entries()) {
        try {
          await tx.unsafe(naredba);
        } catch (greska) {
          const prvi = naredba.split("\n").find((r) => !r.startsWith("--"));
          console.error(`\nPALO na naredbi ${i + 1}:\n  ${prvi}\n`);
          throw greska;
        }
      }
      console.log("Sve naredbe prolaze.\n");

      // The assertions that matter: the constraints accept the real rows.
      const profili = await tx`
        select ime, uloga, tim_id, aktivan from profiles order by ime
      `;
      for (const p of profili) {
        console.log(
          `  ${p.ime}: uloga=${p.uloga} tim=${p.tim_id ?? "-"} aktivan=${p.aktivan}`,
        );
      }

      const [{ count: bezTima }] = await tx`
        select count(*)::int as count from profiles
        where uloga = 'korisnik' and tim_id is null
      `;
      if (bezTima !== 0) throw new Error(`${bezTima} vozaca bez tima`);

      const [{ count: rez }] = await tx`
        select count(*)::int as count from reservations where tim_id is null
      `;
      console.log(`\n  ${rez} rezervacija bi videli samo administratori.`);

      const funkcije = await tx`
        select proname from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('je_clan', 'je_admin', 'moj_tim')
        order by proname
      `;
      console.log(`  funkcije: ${funkcije.map((f) => f.proname).join(", ")}`);

      const politike = await tx`
        select count(*)::int as count from pg_policies where schemaname = 'public'
      `;
      console.log(`  politika ukupno: ${politike[0].count}`);

      throw GOTOVO;
    });
  } catch (greska) {
    if (greska !== GOTOVO) {
      console.error("\nProba nije prosla. Nista nije promenjeno.");
      console.error(greska);
      await sql.end();
      process.exit(1);
    }
  }

  await sql.end();
  console.log("\nProba prosla. Transakcija je ponistena — baza je netaknuta.");
}

main().catch((greska) => {
  console.error(greska);
  process.exit(1);
});
