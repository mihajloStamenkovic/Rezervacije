/**
 * Phone numbers, stored international.
 *
 * `064 123 4567` is a perfectly good number to tap in Belgrade and a dead one
 * to tap on a Greek network. Everything is normalised to E.164 (`+381641234567`)
 * on save, so the *Pozovi* button works from anywhere (SPEC §7).
 *
 * `libphonenumber-js/min` is the small metadata bundle — enough to parse and
 * format, not enough to tell a mobile from a landline. We do not need that.
 */
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

/** The owner types local numbers; anything else must carry its own `+`. */
const PODRAZUMEVANA_ZEMLJA: CountryCode = "RS";

/**
 * E.164 (`+381641234567`), or `null` if the input is not a usable number.
 *
 * Returning `null` rather than throwing keeps this callable straight from a
 * Zod refinement.
 */
export function normalizujTelefon(unos: string): string | null {
  const ociscen = unos.trim();
  if (ociscen === "") return null;

  const broj = parsePhoneNumberFromString(ociscen, PODRAZUMEVANA_ZEMLJA);
  if (!broj || !broj.isValid()) return null;
  return broj.number;
}

export function jeIspravanTelefon(unos: string): boolean {
  return normalizujTelefon(unos) !== null;
}

/**
 * For display: `+381 64 123 4567`.
 *
 * International rather than national even for Serbian numbers — the number is
 * often read while abroad, and the country code is the part that matters then.
 */
export function formatTelefon(e164: string): string {
  const broj = parsePhoneNumberFromString(e164);
  return broj ? broj.formatInternational() : e164;
}

/** `tel:+381641234567` — the dialler wants E.164, not the pretty form. */
export function telLink(e164: string): string {
  const broj = parsePhoneNumberFromString(e164);
  return `tel:${broj ? broj.number : e164}`;
}

/**
 * `viber://chat?number=%2B381641234567` — Viber's click-to-chat deep link.
 *
 * The number carries its `+`, percent-encoded: Viber matches contacts on the
 * international form, so a bare `381…` opens a chat with nobody.
 *
 * A custom scheme rather than an https link — Viber has no `wa.me` equivalent.
 * It hands off to the installed app the way `tel:` hands off to the dialler,
 * and does nothing at all on a device without Viber.
 */
export function viberLink(e164: string): string {
  const broj = parsePhoneNumberFromString(e164);
  const cifre = (broj ? broj.number : e164).replace(/[^\d+]/g, "");
  const saPlusom = cifre.startsWith("+") ? cifre : `+${cifre}`;
  return `viber://chat?number=${encodeURIComponent(saPlusom)}`;
}
