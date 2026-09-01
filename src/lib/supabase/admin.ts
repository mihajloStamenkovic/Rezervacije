/**
 * The admin Supabase client — secret key, BYPASSES ROW LEVEL SECURITY.
 *
 * Server-only, and not for request handling: nothing in this app's request
 * path needs to bypass RLS (Server Actions run as the signed-in user, which
 * is the correct, RLS-checked identity). This client exists for one-off
 * admin scripts — e.g. looking up an `auth.users` id from the dashboard, or
 * calling `auth.admin.*` endpoints — run manually, never imported by a
 * route, Server Action or Server Component.
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
