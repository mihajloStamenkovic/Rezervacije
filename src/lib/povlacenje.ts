/**
 * The arithmetic behind pull-to-refresh, with no React and no DOM in it.
 *
 * Separated so the feel of the gesture can be argued about in a test rather
 * than on a phone: how far the finger has to travel, how much of that travel
 * the indicator actually shows, and at what point letting go means "refresh"
 * instead of "never mind".
 */

/**
 * How far the finger must travel, in CSS pixels, before letting go refreshes.
 *
 * Roughly a thumb's length of deliberate movement. Lower and the list would
 * refresh every time somebody flicks upward past the top of the schedule;
 * higher and it stops feeling like a gesture and starts feeling like a drag.
 */
export const PRAG = 72;

/** The indicator never travels further than this, however long the pull. */
export const MAKS = 104;

/**
 * The indicator moves at half the speed of the finger.
 *
 * This is what makes the pull feel like it is stretching something rather than
 * dragging it: the resistance is the signal that the top of the list is the
 * top, and it is the same trick the platform's own overscroll uses.
 */
const OTPOR = 0.5;

/**
 * Finger travel (px, positive = downward) → how far to show the indicator.
 *
 * An upward or zero movement shows nothing, so a normal scroll never opens the
 * indicator by a pixel.
 */
export function pomerajZa(pomerajPrsta: number): number {
  if (pomerajPrsta <= 0) return 0;
  return Math.min(MAKS, pomerajPrsta * OTPOR);
}

/** Would letting go at this offset refresh? */
export function jeArmirano(pomeraj: number): boolean {
  return pomeraj >= PRAG;
}

/**
 * 0…1, how close the pull is to arming — what the indicator rotates and fades
 * by, so the phone shows the threshold instead of making it guesswork.
 */
export function napredak(pomeraj: number): number {
  if (pomeraj <= 0) return 0;
  return Math.min(1, pomeraj / PRAG);
}
