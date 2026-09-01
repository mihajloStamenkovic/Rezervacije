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
  const korisnikId = data?.claims?.sub;

  // A valid session proves the account exists in auth.users. It does not
  // prove the account may use this app — since migration 0003 that is a row
  // in `profiles` and nothing else.
  //
  // The check belongs *here*, in what this file calls "logged in", rather
  // than only on the pages. If the proxy considered a stray account logged
  // in while the pages refused it, the two would disagree and bounce the
  // browser between `/` and `/prijava` forever. Treating "not a member" as
  // "not logged in" keeps both ends of that redirect honest.
  //
  // This runs through the user's own RLS-bound session, so it is also a live
  // check that the 0003 policies are doing their job: a non-member's select
  // returns no rows rather than being filtered out afterwards. It costs one
  // round trip per navigation, which for a two-person app is worth paying
  // for a boundary that cannot be skipped.
  //
  // Fails closed. An error here reads as "not a member", which sends the
  // browser to a login form it can recover from — the alternative, letting a
  // request through because a check failed, is not recoverable.
  let prijavljen = false;
  if (korisnikId) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", korisnikId)
      .maybeSingle();
    prijavljen = profil != null;
  }

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
