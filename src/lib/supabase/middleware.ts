/**
 * Session refresh + route protection, called from `src/proxy.ts`.
 *
 * This is the convenience boundary, not the security one (see the module
 * comment in `proxy.ts`): the actual boundary is RLS, in
 * `drizzle/0002_profili_i_rls_politike.sql`. This file exists so a
 * logged-out browser is redirected to `/prijava` instead of hitting a wall
 * of empty lists, and so the access token gets refreshed once per
 * navigation rather than once per request.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/env";

const JAVNE_PUTANJE = ["/prijava"];

function jePutanjaJavna(pathname: string): boolean {
  return JAVNE_PUTANJE.some(
    (putanja) => pathname === putanja || pathname.startsWith(`${putanja}/`),
  );
}

export async function azurirajSesiju(request: NextRequest) {
  // Start from a pass-through response bound to the incoming request, so
  // any cookies the Supabase client rewrites below land on the same
  // request/response pair the route ends up rendering with.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    // See the matching comment in src/lib/supabase/server.ts.
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not add logic between `createServerClient` and this call — a stray
  // early return here would skip the refresh and randomly log people out.
  // `getClaims()` verifies the JWT and, if it is close to expiry, refreshes
  // it first via the refresh token, so a session that is merely old (not
  // revoked) keeps renewing itself on every navigation indefinitely.
  const { data } = await supabase.auth.getClaims();
  const prijavljen = data?.claims != null;

  const { pathname } = request.nextUrl;
  const javna = jePutanjaJavna(pathname);

  if (!prijavljen && !javna) {
    const url = request.nextUrl.clone();
    url.pathname = "/prijava";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (prijavljen && javna) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: `response` (not a fresh `NextResponse.next()`) must be
  // returned as-is, or the Set-Cookie headers written by `setAll` above are
  // dropped and the refreshed session never reaches the browser.
  return response;
}
