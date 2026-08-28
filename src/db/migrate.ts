/**
 * Applies the generated migrations in `drizzle/` over the DIRECT connection.
 *
 * Run with `npm run db:migrate`. Migrations must not go through the pooler.
 */
import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { directUrl } from "../env";

async function main() {
  const client = postgres(directUrl(), { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migracije primenjene.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
