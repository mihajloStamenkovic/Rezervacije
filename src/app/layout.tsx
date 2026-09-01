import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegistracijaSw } from "@/components/registracija-sw";
import { TrakaMreze } from "@/components/traka-mreze";
import { T } from "@/lib/tekst";
import "./globals.css";

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
    >
      <body className="min-h-full flex flex-col">
        <RegistracijaSw />
        {/* Above the screens, so it pushes their sticky headers down rather
            than covering the search field. */}
        <TrakaMreze />
        {children}
      </body>
    </html>
  );
}
