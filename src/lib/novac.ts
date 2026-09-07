/**
 * Money — one currency, whole euros, one way of writing it.
 *
 * The price column is `integer` euros by the owner's choice (SPEC §4, amended
 * 07.09.2026), so there is nothing here about cents, rounding or floating
 * point: what was typed is what is stored and what is printed.
 *
 * The grouping is written out rather than handed to `Intl.NumberFormat`, for
 * the same reason `src/lib/datum.ts` formats dates by hand: the test suite runs
 * under five timezones and has to produce identical output, and a formatter
 * whose result depends on the host's ICU build is a dependency this app does
 * not need for four digits. Serbian groups thousands with a full stop —
 * `1.200 €`.
 */

/** `1200` → `"1.200 €"`. Negative prices cannot exist; the column forbids them. */
export function formatCena(evri: number): string {
  const cifre = String(Math.trunc(evri));
  const grupe: string[] = [];
  for (let kraj = cifre.length; kraj > 0; kraj -= 3) {
    grupe.unshift(cifre.slice(Math.max(0, kraj - 3), kraj));
  }
  return `${grupe.join(".")} €`;
}
