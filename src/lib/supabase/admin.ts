/**
 * The admin Supabase client — secret key, BYPASSES ROW LEVEL SECURITY.
 *
 * Server-only. This file used to say it was never to be imported by a route,
 * Server Action or Server Component, and while there was no way to create an
 * account from inside the app that was the right rule. Migration `0004` made
 * account creation the owners' job, from their phone, and
 * `auth.admin.createUser` is the only API that can do it — so the rule is
 * narrowed rather than dropped:
 *
 * **Exactly one module may import this: `src/app/actions/nalozi.ts`**, whose
 * every exported action begins with `zahtevajAdmina()`. Nothing else in the
 * request path needs to bypass RLS, because everything else already reads
 * through Drizzle as the table owner and is scoped by
 * `src/db/vidljivost.ts` instead. If a second importer ever appears, the
 * question to ask is what it is doing that the query layer cannot.
 *
 * No cookies, no session: `supabase-js`'s plain `createClient`, not
 * `@supabase/ssr` (there is no browser/user session to reconcile with).
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/env";

export function supabaseAdmin() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
