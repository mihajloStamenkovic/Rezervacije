/**
 * Light or dark — SPEC §6, added 09.09.2026 at the owner's request.
 *
 * **The choice belongs to the phone, not to the account.** It is a `localStorage`
 * key and nothing else: no column, no migration, no round trip, and it works
 * with no signal. Two people sharing one account on two phones can read the
 * app the way each of them wants to, and the same person's second device is
 * simply a second choice to make — which is right, because the reason to want
 * a dark screen is the light in the room, not who is holding it.
 *
 * **Until a choice is made the phone still decides.** There are two buttons,
 * not three, so there is no *Sistemski* to pick; instead an untouched app
 * behaves exactly as it always did — dark at night if the phone is dark at
 * night — and the first tap is what freezes it. Nobody who never opens
 * Podešavanja sees any change at all.
 *
 * Nothing here touches the DOM. The applying is done twice, in two places that
 * cannot import each other: the blocking script in `layout.tsx`, which has to
 * run before the first paint, and `PrekidacTeme`, which runs on a tap. Both
 * read their constants from this file so the two cannot drift.
 */

export type Tema = "svetla" | "tamna";

/** Left to right, and the order the buttons are drawn in. */
export const TEME: readonly Tema[] = ["svetla", "tamna"];

/** The `localStorage` key. Short, and namespaced by the origin already. */
export const KLJUC_TEME = "tema";

/** The class the root element carries. `svetla` forces light, `tamna` dark. */
export const KLASA: Record<Tema, string> = {
  svetla: "svetla",
  tamna: "tamna",
};

/**
 * The status bar colour that sits directly above the app's header in
 * standalone mode, per theme.
 *
 * Hex rather than `oklch`, because the meta tag is read by the OS shell and
 * not by the CSS engine. `#ffffff` is `oklch(1 0 0)` and `#242424` is
 * `oklch(0.145 0 0)` — the two `--background` values in `globals.css`. A light
 * status bar over a dark screen is the seam that makes an installed PWA look
 * like a web page in a costume, and a *forced* theme is exactly where that
 * seam opens: the meta tags are matched on the phone's preference, which is
 * the thing the switch is overriding.
 */
export const BOJA_TRAKE: Record<Tema, string> = {
  svetla: "#ffffff",
  tamna: "#242424",
};

export function jeTema(vrednost: unknown): vrednost is Tema {
  return vrednost === "svetla" || vrednost === "tamna";
}

/**
 * What was stored, or `null` for "nothing chosen yet".
 *
 * Deliberately forgiving, for the same reason the URL parser is: the value
 * comes out of a store the user's browser owns and can hold anything at all,
 * and an unreadable one has to mean "no choice" rather than throw. Throwing
 * here would take the whole app down before it painted — this runs in the
 * blocking script.
 */
export function procitajTemu(sirovo: string | null | undefined): Tema | null {
  return jeTema(sirovo) ? sirovo : null;
}

/** The theme actually on screen: the stored choice, else the phone's. */
export function temaZaPrimenu(
  sacuvana: Tema | null,
  telefonJeTaman: boolean,
): Tema {
  if (sacuvana !== null) return sacuvana;
  return telefonJeTaman ? "tamna" : "svetla";
}
