/**
 * The server Supabase client — publishable key plus the caller's cookie
 * session, still respects RLS. For Server Components, Server Actions and
 * Route Handlers.
 *
 * Always create a new client per request with this function — never share
 * one across requests. `cookies()` is request-scoped in Next.js, so a
 * module-level singleton here would leak one user's session into another's
 * request.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/env";

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    // @supabase/ssr's own default omits `secure` (it does not know at this
    // layer whether it is behind HTTPS). Force it in production — Vercel
    // terminates TLS in front of every deployment, so there is never a
    // legitimate plain-HTTP request to accommodate there.
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `cookies().set()` throws when called from a Server Component
          // rendering pass, which cannot write response headers. Safe to
          // ignore here: the proxy (src/proxy.ts) refreshes the session on
          // every request and writes the cookie back from there instead.
        }
      },
    },
  });
}
