/**
 * The reservation form's shape, validated once and used on both sides.
 *
 * The same schema runs in the browser for immediate feedback and again inside
 * the Server Action, which is the only one of the two that counts — a Server
 * Action is a public endpoint and the client half is a convenience.
 *
 * Two transformations happen here rather than in the form, because they must
 * hold whoever is calling:
 *
 *   - **The phone number is normalised to E.164.** `064 123 4567` does not
 *     dial from a Greek network; `+381641234567` does (SPEC §7).
 *   - **An empty return date becomes `null`, not `""`.** A blank
 *     `<input type="date">` submits an empty string, and `""` in a `date`
 *     column is an error, not an absent value.
 *
 * No JS `Date` is constructed anywhere in this file. Dates are `YYYY-MM-DD`
 * strings end to end (standing rule 4), and `"2026-01-20" >= "2026-01-15"` is
 * exactly the comparison the return-before-departure check needs.
 */
import { z } from "zod";
import { jeDatum } from "@/lib/datum";
import { normalizujTelefon } from "@/lib/telefon";
import { T } from "@/lib/tekst";

const datumPolaska = z
  .string()
  .trim()
  .min(1, { message: T.greske.datumPolaskaObavezan })
  .refine(jeDatum, { message: T.greske.datumNeispravan });

/**
 * `z.uuid` rather than a bare string: the value comes from a `<select>` whose
 * options are the reference table, so anything that is not a destination id is
 * a tampered submission, not a typo. Both cases get the same Serbian message —
 * "pick a destination" is the only useful thing to say about either.
 */
const destinacija = z.uuid({ message: T.greske.destinacijaObavezna });

export const RezervacijaSchema = z
  .object({
    ime: z.string().trim().min(1, { message: T.greske.imeObavezno }),

    telefon: z
      .string()
      .trim()
      .min(1, { message: T.greske.telefonObavezan })
      // Normalising inside the schema means the Server Action can never
      // receive a national-format number by forgetting to call it.
      .transform((v, ctx) => {
        const e164 = normalizujTelefon(v);
        if (e164 === null) {
          ctx.addIssue({
            code: "custom",
            message: T.greske.telefonNeispravan,
          });
          return z.NEVER;
        }
        return e164;
      }),

    destinacijaId: destinacija,
    datumPolaska,

    destinacijaPovratkaId: destinacija,
    // A return that has not been agreed yet is a legitimate booking (SPEC §8).
    datumPovratka: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || jeDatum(v), {
        message: T.greske.datumNeispravan,
      }),

    // Not `z.coerce.number()`: an empty field coerces to 0, which would be
    // reported as "must be greater than zero" when the real problem is that
    // nothing was entered.
    brojPutnika: z
      .string()
      .trim()
      .min(1, { message: T.greske.brojPutnikaObavezan })
      .transform((v, ctx) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) {
          ctx.addIssue({
            code: "custom",
            message: T.greske.brojPutnikaNeispravan,
          });
          return z.NEVER;
        }
        return n;
      }),
  })
  .refine(
    (v) => v.datumPovratka === null || v.datumPovratka >= v.datumPolaska,
    {
      message: T.greske.povratakPrePolaska,
      path: ["datumPovratka"],
    },
  );

export type UlazRezervacije = z.input<typeof RezervacijaSchema>;
export type PodaciRezervacije = z.output<typeof RezervacijaSchema>;

/** Field name → first message. One message per field is all the form shows. */
export type GreskePolja = Partial<Record<keyof UlazRezervacije, string>>;

export type StanjeForme =
  | { ok: true }
  | { ok: false; greske: GreskePolja; opsta?: string }
  | undefined;

/**
 * Reads a submitted form into the schema's input shape.
 *
 * Every value is coerced to a string first: `FormData.get` returns
 * `File | string | null`, and a missing field must arrive as `""` so the
 * schema reports "this is required" rather than "expected string".
 */
export function izFormData(formData: FormData): UlazRezervacije {
  const uzmi = (kljuc: string) => {
    const v = formData.get(kljuc);
    return typeof v === "string" ? v : "";
  };

  return {
    ime: uzmi("ime"),
    telefon: uzmi("telefon"),
    destinacijaId: uzmi("destinacijaId"),
    datumPolaska: uzmi("datumPolaska"),
    destinacijaPovratkaId: uzmi("destinacijaPovratkaId"),
    datumPovratka: uzmi("datumPovratka"),
    brojPutnika: uzmi("brojPutnika"),
  };
}

/**
 * Flattens a Zod error into the one-message-per-field shape the form renders.
 *
 * Walks `issues` directly rather than using `z.flattenError`, whose
 * `fieldErrors` is typed as `{}` for a schema carrying an object-level
 * `.refine` — and this schema carries one, for the return-before-departure
 * rule. First message per field wins: the field only has room for one, and the
 * first is the most specific.
 */
export function greskePolja(greska: z.ZodError): GreskePolja {
  const greske: GreskePolja = {};
  for (const problem of greska.issues) {
    const polje = problem.path[0];
    if (typeof polje !== "string") continue;
    const kljuc = polje as keyof UlazRezervacije;
    if (greske[kljuc] === undefined) greske[kljuc] = problem.message;
  }
  return greske;
}
