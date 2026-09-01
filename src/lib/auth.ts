import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The session check every page and Server Action runs for itself.
 *
 * `src/proxy.ts` already redirects a logged-out browser, so why check again?
 * Because the data on these screens is read through `src/db/queries.ts`, which
 * connects as `postgres` — the owner of the tables — and therefore **bypasses
 * RLS**. For a REST call with the publishable key, RLS is the boundary and it
 * holds. For a server render, it is not in the path at all, and the only thing
 * standing between an unauthenticated request and the reservations would be
 * the proxy.
 *
 * A proxy is the wrong thing to rest that on. It is a convenience redirect by
 * design (see the note at the top of `src/proxy.ts`), it can be skipped by
 * route-matcher mistakes, and Next's own middleware layer has had a bypass
 * (CVE-2025-29927) that a crafted header was enough to trigger. So the check
 * is repeated where the data actually is: cheap, local to the request, and
 * true regardless of what ran before it.
 *
 * `getClaims()` rather than `getUser()`: it verifies the JWT signature
 * locally, which is what makes this affordable to call on every render.
 */
export type Korisnik = { id: string };

export async function zahtevajKorisnika(): Promise<Korisnik> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims.sub;

  if (error || !id) redirect("/prijava");
  return { id };
}
