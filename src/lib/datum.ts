/**
 * Calendar dates, Belgrade time.
 *
 * The whole app hinges on one question — "has the departure passed?" — and the
 * answer has to be the same for both accounts no matter which country either
 * of them is standing in (SPEC §7).
 *
 * Two rules hold that together:
 *
 *   1. "Today" is always Belgrade, never the device clock.
 *   2. A calendar date is the string `YYYY-MM-DD` and stays a string. A JS
 *      `Date` built from `"2026-01-01"` is midnight *UTC*, which is the
 *      previous evening in Auckland and prints as 31.12. — so we never build
 *      one. Every formatter here parses the string into its parts and formats
 *      those parts directly.
 */
import { srLatn } from "date-fns/locale/sr-Latn";

/** A calendar date with no time component, e.g. `"2026-01-15"`. */
export type Datum = string;

const OBRAZAC = /^\d{4}-\d{2}-\d{2}$/;

export function jeDatum(vrednost: unknown): vrednost is Datum {
  if (typeof vrednost !== "string" || !OBRAZAC.test(vrednost)) return false;
  const [g, m, d] = razloziDatum(vrednost);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= brojDanaUMesecu(g, m);
}

function brojDanaUMesecu(godina: number, mesec: number): number {
  return new Date(Date.UTC(godina, mesec, 0)).getUTCDate();
}

function razloziDatum(datum: Datum): [number, number, number] {
  return [
    Number(datum.slice(0, 4)),
    Number(datum.slice(5, 7)),
    Number(datum.slice(8, 10)),
  ];
}

function proveri(datum: Datum): Datum {
  if (!jeDatum(datum)) throw new Error(`Neispravan datum: ${String(datum)}`);
  return datum;
}

/**
 * Today, in Europe/Belgrade, as `YYYY-MM-DD`.
 *
 * `sv-SE` is the trick: it is the one common locale whose short date format is
 * already ISO, so no reassembly is needed.
 *
 * Call this once per request at the edge of the app and pass the result down.
 * Nothing below the entry point should call it — the domain core takes `danas`
 * as an argument so it can be tested at any date.
 */
export function danasBeograd(sada: Date = new Date()): Datum {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Belgrade",
  }).format(sada);
}

/** Arithmetic on the calendar, done in UTC so no zone can shift the result. */
export function pomeriDane(datum: Datum, dana: number): Datum {
  const [g, m, d] = razloziDatum(proveri(datum));
  const t = new Date(Date.UTC(g, m - 1, d + dana));
  return `${t.getUTCFullYear()}-${dva(t.getUTCMonth() + 1)}-${dva(t.getUTCDate())}`;
}

/** Whole days from `od` to `do`. Negative when `do` is earlier. */
export function razlikaUDanima(od: Datum, do_: Datum): number {
  const a = uUtc(proveri(od));
  const b = uUtc(proveri(do_));
  return Math.round((b - a) / 86_400_000);
}

function uUtc(datum: Datum): number {
  const [g, m, d] = razloziDatum(datum);
  return Date.UTC(g, m - 1, d);
}

function dva(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Weekday index, 0 = Monday … 6 = Sunday. Computed from the string, not from a
 * local `Date`, so it is stable everywhere.
 */
export function danUNedelji(datum: Datum): number {
  const dan = new Date(uUtc(proveri(datum))).getUTCDay(); // 0 = Sunday
  return (dan + 6) % 7;
}

/** Monday of the week containing `datum`. */
export function pocetakNedelje(datum: Datum): Datum {
  return pomeriDane(datum, -danUNedelji(datum));
}

/** Sunday of the week containing `datum`. */
export function krajNedelje(datum: Datum): Datum {
  return pomeriDane(pocetakNedelje(datum), 6);
}

export function pocetakMeseca(datum: Datum): Datum {
  return `${proveri(datum).slice(0, 8)}01`;
}

export function krajMeseca(datum: Datum): Datum {
  const [g, m] = razloziDatum(proveri(datum));
  return `${g}-${dva(m)}-${dva(brojDanaUMesecu(g, m))}`;
}

const DANI = [
  "ponedeljak",
  "utorak",
  "sreda",
  "četvrtak",
  "petak",
  "subota",
  "nedelja",
] as const;

const MESECI = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
] as const;

/** `01.01.2026` — the form Serbian readers expect. */
export function formatDatum(datum: Datum): string {
  const [g, m, d] = razloziDatum(proveri(datum));
  return `${dva(d)}.${dva(m)}.${g}.`;
}

/** `01.01.` — for headings where the year is obvious. */
export function formatDanMesec(datum: Datum): string {
  const [, m, d] = razloziDatum(proveri(datum));
  return `${dva(d)}.${dva(m)}.`;
}

/** `1. januar 2026.` — for the detail screen, where there is room. */
export function formatDug(datum: Datum): string {
  const [g, m, d] = razloziDatum(proveri(datum));
  return `${d}. ${MESECI[m - 1]} ${g}.`;
}

export function imeDana(datum: Datum): string {
  return DANI[danUNedelji(proveri(datum))];
}

/**
 * The heading above a group of cards: `danas`, `sutra`, `juče`, otherwise
 * `subota, 12.09.` — and the year too once it is a different one.
 */
export function naslovDana(datum: Datum, danas: Datum): string {
  const razlika = razlikaUDanima(danas, datum);
  if (razlika === 0) return "danas";
  if (razlika === 1) return "sutra";
  if (razlika === -1) return "juče";

  const istaGodina = datum.slice(0, 4) === danas.slice(0, 4);
  const dan = imeDana(datum);
  return istaGodina
    ? `${dan}, ${formatDanMesec(datum)}`
    : `${dan}, ${formatDatum(datum)}`;
}

/** For `<input type="date">`, which speaks `YYYY-MM-DD` natively. */
export function zaInput(datum: Datum | null | undefined): string {
  return datum && jeDatum(datum) ? datum : "";
}

/** Re-exported so nothing else has to reach into date-fns for the locale. */
export { srLatn };
