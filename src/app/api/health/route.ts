/**
 * Liveness check — `GET /api/health`.
 *
 * Answers one question: can this deployment reach the database *right now*?
 * "The site loads" does not answer it, because every page in this app renders
 * fine from the edge and only fails once a query runs.
 *
 * Deliberately unauthenticated. A monitor cannot log in, and this is what
 * would page somebody at 02:00. It is excluded from the proxy matcher in
 * `src/proxy.ts` for the same reason — without that it answers `307 /prijava`
 * and every uptime service reports the app as healthy while the database is
 * gone.
 *
 * It leaks nothing worth having: a count of reference rows, a duration, and
 * the Belgrade date. No reservation, no name, no phone number, and — see the
 * catch — no error text, because a driver error can carry the host it failed
 * to reach.
 */
import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { destinacije } from "@/db/schema";
import { danasBeograd } from "@/lib/datum";

/*
 * Never prerendered, never cached. A health check served from cache is worse
 * than none: it reports the state of whichever moment it was captured, which
 * is by definition a moment when things were fine.
 */
export const dynamic = "force-dynamic";

const BEZ_KESA = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export async function GET() {
  const pocetak = Date.now();

  try {
    /*
     * `destinacije` rather than `SELECT 1`: a pooler that answers while the
     * schema is missing is not a healthy deployment, and this proves both in
     * one round trip. It is also reference data — the one table where a row
     * count discloses nothing about anybody.
     */
    const [red] = await db.select({ broj: count() }).from(destinacije);

    return Response.json(
      {
        status: "ok",
        baza: "ok",
        destinacija: red.broj,
        trajanjeMs: Date.now() - pocetak,
        danas: danasBeograd(),
      },
      { headers: BEZ_KESA },
    );
  } catch (greska) {
    /*
     * The message goes to the runtime log, never to the response. Postgres
     * driver errors routinely name the host and port they failed to reach,
     * and this endpoint is public.
     */
    console.error(
      "[health] baza nedostupna:",
      greska instanceof Error ? greska.message : String(greska),
    );

    return Response.json(
      { status: "greska", baza: "nedostupna", trajanjeMs: Date.now() - pocetak },
      { status: 503, headers: BEZ_KESA },
    );
  }
}
