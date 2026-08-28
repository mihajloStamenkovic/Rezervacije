import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("Nedostaje DIRECT_URL (ili DATABASE_URL). Vidi .env.example.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
