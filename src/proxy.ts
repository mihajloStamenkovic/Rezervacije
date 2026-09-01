/**
 * Route protection — Next.js Proxy (formerly Middleware; the file and
 * export were renamed in Next 16, see AGENTS.md and
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * A `middleware.ts` file at this location would still be picked up by the
 * deprecated shim, but `next dev`/`next build` warn on it, so this project
 * uses the current name.
 *
 * This is the CONVENIENCE boundary: it redirects a logged-out browser to
 * `/prijava` so the app does not just render a wall of empty lists. It is
 * NOT the security boundary — anyone can skip this file entirely and `curl`
 * `/rest/v1/reservations` directly with the publishable key. RLS
 * (`drizzle/0002_profili_i_rls_politike.sql`) is what actually stops that,
 * and it does not care whether this file ever ran.
 */
import type { NextRequest } from "next/server";
import { azurirajSesiju } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  return azurirajSesiju(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     * - _next/static, _next/image (Next's own build/image assets)
     * - favicon.ico, the manifest, the icons and the service worker, so a
     *   browser deciding whether the app is installable is handed the files
     *   rather than a 307 to /prijava on a logged-out visit to the bare
     *   domain. Without this the install prompt never appears at all.
     *
     * The icons live under `/ikone/`, not `/icons/`. This list was written in
     * Phase 4 against a guess at the directory name, and the guess was
     * English; Phase 6 built the directory in Serbian like everything else,
     * and the mismatch cost every icon a redirect until it was caught.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|ikone/).*)",
  ],
};
