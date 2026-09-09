/**
 * The arithmetic behind the swipe between *Odlasci* and *Povratak*, with no
 * React and no DOM in it.
 *
 * Separated for the same reason `povlacenje.ts` is: the feel of a gesture is
 * the part everyone has an opinion about, and it is far easier to argue about
 * it in a test than on a phone. What is decided here is when a finger movement
 * counts as horizontal at all, how far it has to go to change tab, and what
 * happens when there is no tab on that side.
 */

/**
 * How far the finger must travel, in CSS pixels, before the gesture commits to
 * an axis.
 *
 * Below this it is neither a scroll nor a swipe, and guessing early is how a
 * list ends up changing tab because somebody's thumb wobbled on the way down.
 */
export const PRAG_OSE = 12;

/**
 * Which way this movement is going, or `null` while it is too early to say.
 *
 * The comparison is deliberately lopsided: horizontal has to beat vertical by
 * a clear margin, because the list is scrolled far more often than the tab is
 * changed, and a scroll that turns into a tab change is much the worse of the
 * two mistakes.
 */
export function odlukaOse(dx: number, dy: number): "x" | "y" | null {
  const vodoravno = Math.abs(dx);
  const uspravno = Math.abs(dy);
  if (vodoravno < PRAG_OSE && uspravno < PRAG_OSE) return null;
  return vodoravno > uspravno * 1.4 ? "x" : "y";
}

/**
 * How much of the finger's travel the panel actually follows.
 *
 * With a tab on that side it follows exactly — the panel is under the finger.
 * With nothing there it follows at a quarter speed, which is the platform's
 * own way of saying "this is the end" without a message.
 */
const OTPOR_IVICE = 0.25;

export function pomerajPrevlacenja(dx: number, imaSuseda: boolean): number {
  return imaSuseda ? dx : dx * OTPOR_IVICE;
}

/** Never less than this, however narrow the screen. */
export const NAJMANJI_PRAG = 56;

/** A quarter of the panel — a deliberate push, not a nudge. */
const DEO_SIRINE = 0.25;

/** Would letting go here change tab? */
export function prebacujeLi(pomeraj: number, sirina: number): boolean {
  const prag = Math.max(NAJMANJI_PRAG, sirina * DEO_SIRINE);
  return Math.abs(pomeraj) >= prag;
}

/**
 * The tab a drag of this sign reveals, or `null` at either end.
 *
 * Dragging **left** pulls the next tab in from the right, which is why a
 * negative offset means a higher index.
 */
export function susedniIndeks(
  indeks: number,
  pomeraj: number,
  ukupno: number,
): number | null {
  if (pomeraj === 0) return null;
  const kandidat = pomeraj < 0 ? indeks + 1 : indeks - 1;
  return kandidat < 0 || kandidat >= ukupno ? null : kandidat;
}
