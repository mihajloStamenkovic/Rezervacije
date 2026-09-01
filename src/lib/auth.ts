import "server-only";

import { redirect } from "next/navigation";
import { profilPoId } from "@/db/queries";
import type { Profile } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The check every page and Server Action runs for itself.
 *
 * Two questions, and both have to be asked.
 *
 * **1. Is there a valid session?** `src/proxy.ts` already redirects a
 * logged-out browser, so why here too? Because these screens read through
 * `src/db/queries.ts`, which connects as `postgres` — the owner of the tables
 * — and therefore **bypasses RLS**. For a REST call with the publishable key,
 * RLS is the boundary and it holds. For a server render it is not in the path
 * at all, and the only thing left would be the proxy: a convenience redirect
 * by its own documentation, on a layer that has had a real bypass
 * (CVE-2025-29927). So the check is repeated where the data actually is.
 *
 * **2. Is the account on the access list?** A valid Supabase session proves
 * someone exists in `auth.users`. It does not prove they may use this app.
 * Since migration 0003 the answer to that is one thing and one thing only: a
 * row in `profiles`. Signups are also switched off in the dashboard, but that
 * is a toggle someone can flip back, and this is not.
 *
 * `getClaims()` verifies the JWT signature locally, which is what makes the
 * first half affordable on every render; the second half is a primary-key
 * lookup on a two-row table.
 *
 * Note what this deliberately does *not* do: sign the stray account out. A
 * Server Component cannot write cookies, so `signOut()` here would throw
 * during render. The session is left alone and simply refused — the proxy
 * turns it away on the next navigation, and `prijaviSe` refuses to mint
 * another one.
 */
export async function zahtevajKorisnika(): Promise<Profile> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims.sub;

  if (error || !id) redirect("/prijava");

  const profil = await profilPoId(id);
  if (!profil) redirect("/prijava");

  return profil;
}
