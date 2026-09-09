import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PovuciZaOsvezavanje } from "@/components/povuci-za-osvezavanje";
import { RegistracijaSw } from "@/components/registracija-sw";
import { TrakaMreze } from "@/components/traka-mreze";
import { T } from "@/lib/tekst";
import { BOJA_TRAKE, KLASA, KLJUC_TEME } from "@/lib/tema";
import "./globals.css";

/**
 * Light or dark, decided before the first pixel — SPEC §6.
 *
 * This has to be a blocking inline script and it has to run here. The class
 * lives on `<html>`, and anything that set it later — an effect, a component,
 * anything React does — would paint the wrong theme first and correct it a
 * frame afterwards. That flash is the whole reason this pattern exists.
 *
 * It is written out as a string because it runs before any bundle: it cannot
 * import `tema.ts`, so it is *generated* from those constants instead, which
 * is what stops the class names and the status bar colours drifting from the
 * ones `PrekidacTeme` and `globals.css` use.
 *
 * With nothing stored it follows the phone and keeps following it, so an app
 * whose owner never opens Podešavanja behaves exactly as it did before the
 * switch existed. Everything is inside a `try`: `localStorage` throws outright
 * in some privacy modes, and a theme is never worth a blank screen.
 *
 * It **strips the `media` attribute** off the `theme-color` tags rather than
 * only rewriting them. `viewport.themeColor` below declares one per phone
 * preference, which is the right answer while no choice is stored and the
 * wrong one the moment a choice overrides the phone; and Next adds a third tag
 * of its own during hydration, so trusting document order to settle which wins
 * would be trusting a detail of the framework. A tag with no `media` always
 * matches, and the browser takes the first match — so ours is the answer
 * whatever arrives afterwards.
 */
const SKRIPTA_TEME = `(function(){
var K=${JSON.stringify(KLJUC_TEME)},S=${JSON.stringify(KLASA.svetla)},T=${JSON.stringify(KLASA.tamna)};
var B={};B[S]=${JSON.stringify(BOJA_TRAKE.svetla)};B[T]=${JSON.stringify(BOJA_TRAKE.tamna)};
function p(t){var k=document.documentElement.classList;k.toggle(T,t===T);k.toggle(S,t===S);
var m=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<m.length;i++){m[i].removeAttribute("media");
m[i].setAttribute("content",B[t]);}}
try{var s=localStorage.getItem(K);var u=matchMedia("(prefers-color-scheme: dark)");
if(s===S||s===T){p(s);}else{p(u.matches?T:S);
u.addEventListener("change",function(e){p(e.matches?T:S);});}
document.addEventListener("DOMContentLoaded",function(){
p(document.documentElement.classList.contains(T)?T:S);});}catch(e){}
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: T.app.naziv,
  description: T.app.opis,
  applicationName: T.app.naziv,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/ikone/ikona-192.png", sizes: "192x192", type: "image/png" },
      { url: "/ikone/ikona-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/ikone/apple-touch-icon.png", sizes: "180x180" },
  },
  appleWebApp: {
    capable: true,
    // What sits under the icon once it is on the home screen — the long name
    // gets an ellipsis there.
    title: T.app.kratakNaziv,
    // `default` leaves the status bar opaque and the app below it, which is
    // what the sticky headers are laid out for. `black-translucent` would
    // slide the whole app up underneath the clock.
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /*
   * The colour of the status bar sitting directly above the app's header in
   * standalone mode, so it is the app's own `--background` rather than the
   * icon's blue-black. Two values, matched to the two `:root` palettes in
   * `globals.css` — a light status bar over a dark screen is the seam that
   * makes an installed PWA look like a web page in a costume.
   *
   * `oklch(1 0 0)` is #ffffff and `oklch(0.145 0 0)` is #242424; these are
   * hex because the meta tag is read by the OS shell, not by the CSS engine.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#242424" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr-Latn-RS"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script adds `svetla` or `tamna` to this element before React
      // ever sees it, so the class it hydrates against is legitimately not the
      // one the server sent.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* First thing in the document, and blocking on purpose — see above. */}
        <script dangerouslySetInnerHTML={{ __html: SKRIPTA_TEME }} />
        <RegistracijaSw />
        {/* Above the screens, so it pushes their sticky headers down rather
            than covering the search field. */}
        <TrakaMreze />
        {/* Installed to the home screen there is no address bar, so this is
            the only reload the app has. It overlays rather than pushing:
            nothing on screen may move while a finger is on it. */}
        <PovuciZaOsvezavanje />
        {children}
      </body>
    </html>
  );
}
