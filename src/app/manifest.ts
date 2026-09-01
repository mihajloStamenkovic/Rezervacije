/**
 * The web app manifest — served at `/manifest.webmanifest`.
 *
 * `src/proxy.ts` already excludes that path from the auth redirect, so the
 * manifest and the icons it names are reachable on a logged-out visit to the
 * bare domain. Without that, a browser deciding whether the app is
 * installable would be handed a 307 to `/prijava` instead of JSON, and the
 * install prompt would never appear.
 *
 * `theme_color` is the app's own background rather than the icon's, because it
 * colours the status bar sitting directly above the app's header. Unlike the
 * `themeColor` meta in `layout.tsx` it cannot carry a light/dark pair — the
 * manifest format has no media queries — so it stays light, which is also the
 * right colour for the splash screen the launcher paints before the app boots.
 */
import type { MetadataRoute } from "next";
import { T } from "@/lib/tekst";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: T.app.naziv,
    short_name: T.app.kratakNaziv,
    description: T.app.opis,
    lang: "sr-Latn",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The screens are one column of cards and one column of fields. There is
    // nothing a landscape phone would do with the extra width except make
    // every line too long to scan.
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/ikone/ikona-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ikone/ikona-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android crops this one to whatever shape the launcher uses, so its
        // mark sits well inside the safe zone and its background bleeds out.
        src: "/ikone/ikona-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
