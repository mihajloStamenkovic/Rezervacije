/**
 * Idempotent destination seed (SPEC §5, "Keeping the data current").
 *
 * Keyed on `drzava_sifra` + `regija` + `grad`. It inserts new rows, updates
 * changed display names and ordering, and flips `aktivna`.
 *
 * It NEVER deletes. A reservation may point at any row, including one the
 * client has since dropped from their site — deleting it would break that
 * booking's rendering forever.
 *
 * Rerunnable: `npm run db:seed:destinacije`.
 */
import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { directUrl } from "../env";
import { destinacije } from "./schema";
import { ucitajDestinacije, type DestinacijaSeed } from "./destinacije-json";

export type SeedIzvestaj = {
  ukupno: number;
  ubaceno: number;
  izmenjeno: number;
  nepromenjeno: number;
  /** Rows in the table that the JSON no longer mentions. Reported, never deleted. */
  siroce: string[];
};

type Db = ReturnType<typeof drizzle>;

export async function seedDestinacije(
  db: Db,
  redovi: DestinacijaSeed[] = ucitajDestinacije(),
): Promise<SeedIzvestaj> {
  const pre = await db.select().from(destinacije);
  const postojece = new Map(
    pre.map((d) => [`${d.drzavaSifra}|${d.regija}|${d.grad}`, d]),
  );

  let ubaceno = 0;
  let izmenjeno = 0;
  let nepromenjeno = 0;

  for (const red of redovi) {
    const kljuc = `${red.drzavaSifra}|${red.regija}|${red.grad}`;
    const staro = postojece.get(kljuc);

    if (!staro) {
      ubaceno += 1;
    } else if (
      staro.drzava === red.drzava &&
      staro.aktivna === red.aktivna &&
      staro.redosled === red.redosled
    ) {
      nepromenjeno += 1;
      postojece.delete(kljuc);
      continue;
    } else {
      izmenjeno += 1;
    }
    postojece.delete(kljuc);

    await db
      .insert(destinacije)
      .values(red)
      .onConflictDoUpdate({
        target: [destinacije.drzavaSifra, destinacije.regija, destinacije.grad],
        set: {
          drzava: sql`excluded.drzava`,
          aktivna: sql`excluded.aktivna`,
          redosled: sql`excluded.redosled`,
        },
      });
  }

  return {
    ukupno: redovi.length,
    ubaceno,
    izmenjeno,
    nepromenjeno,
    // Whatever is left in the map exists in the database but not in the JSON.
    siroce: [...postojece.keys()],
  };
}

async function main() {
  const client = postgres(directUrl(), { max: 1 });
  try {
    const izvestaj = await seedDestinacije(drizzle(client));
    console.log(
      `Destinacije: ${izvestaj.ukupno} u JSON-u — ` +
        `${izvestaj.ubaceno} ubačeno, ${izvestaj.izmenjeno} izmenjeno, ` +
        `${izvestaj.nepromenjeno} nepromenjeno.`,
    );
    if (izvestaj.siroce.length > 0) {
      console.warn(
        `Upozorenje: ${izvestaj.siroce.length} red(ova) u bazi nema više ` +
          `odgovarajući zapis u destinacije.json. Nisu obrisani:\n  ` +
          izvestaj.siroce.join("\n  "),
      );
    }
  } finally {
    await client.end();
  }
}

// Runs only when invoked directly, so tests can import `seedDestinacije`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
