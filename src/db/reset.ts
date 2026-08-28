/**
 * Drops this app's tables and the migration ledger, so `db:reset` can rebuild
 * the database from scratch.
 *
 * There is **one database and it is the real one** — dev and production are the
 * same hosted Supabase project. So this refuses to run unless it is told to, in
 * a way nobody types by accident:
 *
 *     POTVRDA="OBRISI SVE" npm run db:reset
 *
 * It drops the four tables it knows about plus the `drizzle` schema, rather
 * than `drop schema public cascade`. Recreating `public` on a Supabase project
 * would take its role grants and extensions with it — targeted drops leave all
 * of that alone.
 */
import "./env";
import postgres from "postgres";
import { directUrl } from "../env";

const POTVRDA = "OBRISI SVE";

/** Child tables first; `cascade` covers the rest. */
const TABELE = ["reservations", "settings", "profiles", "destinacije"] as const;

async function main() {
  const url = directUrl();
  const host = new URL(url).host;

  if (process.env.POTVRDA !== POTVRDA) {
    console.error(
      [
        "",
        `  Ovo briše SVE podatke na: ${host}`,
        "",
        "  Dev i produkcija su ista baza. Nema undo, nema kante za smeće.",
        "",
        "  Ako si siguran:",
        `      POTVRDA="${POTVRDA}" npm run db:reset`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(`Brišem sve tabele na ${host} …`);
  const sql = postgres(url, { max: 1 });
  try {
    for (const tabela of TABELE) {
      await sql`drop table if exists ${sql(tabela)} cascade`;
    }
    // The migration ledger, so `db:migrate` replays from 0000.
    await sql`drop schema if exists drizzle cascade`;
    console.log("Obrisano. Pokreni migracije i seed.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
