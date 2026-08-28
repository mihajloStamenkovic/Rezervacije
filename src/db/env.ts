/**
 * Loads `.env.local` for scripts run outside Next.js (migrations, seeds,
 * tests). Next loads it on its own; `tsx` does not.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
