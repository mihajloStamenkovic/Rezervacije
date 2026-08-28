/**
 * The application's database handle — pooled connection, server only.
 *
 * Migrations and seeds do not use this; they open their own single-use
 * connection against `DIRECT_URL` (see `migrate.ts`).
 */
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "@/env";
import * as schema from "./schema";

declare global {
  // Next's dev server re-evaluates modules on every change; without this the
  // connection count climbs until Postgres refuses new ones.
  var __kombiSql: ReturnType<typeof postgres> | undefined;
}

const client = globalThis.__kombiSql ?? postgres(databaseUrl(), { prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__kombiSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
