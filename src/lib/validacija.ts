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
import type { NovoMesto } from "@/domen/kaskada";
import { jeDatum } from "@/lib/datum";
import { normalizujTelefon } from "@/lib/telefon";
import { T } from "@/lib/tekst";

const datumPolaska = z
  .string()
  .trim()
  .min(1, { message: T.greske.datumPolaskaObavezan })
  .refine(jeDatum, { message: T.greske.datumNeispravan });

/**
 * A leg's destination arrives as one of two things — SPEC §5, amended
 * 06.09.2026.
 *
 * Either an **id** picked from the dropdowns, or a **place typed by hand**
 * when the town is not in the list. The country is always picked, never typed,
 * so what is typed is at most a region and a city.
 *
 * The two are carried in one field rather than two so the form has one error
 * slot per leg. `id` still has to be a uuid — the value comes from a `<select>`
 * whose options are the reference table, so anything else is a tampered
 * submission, not a typo — but an *empty* id is no longer a failure on its own,
 * because it is what a hand-typed place looks like.
 *
 * Nothing is created here. This says only that the input is well formed; the
 * Server Action is what turns a typed place into a row, because that needs the
 * catalogue and this file must never grow a database.
 */
export type IzborDestinacije =
  | { id: string; novo: null }
  | { id: null; novo: NovoMesto };

/**
 * Longest name accepted for a typed region or city.
 *
 * A guardrail, not a business rule: the column is `text` and takes anything,
 * but a name that does not fit a phone screen is a paste accident, and the row
 * it would create is permanent (destinations are never deleted).
 */
export const MAX_NAZIVA = 60;

export const DestinacijaSchema = z
  .object({
    id: z.string().trim(),
    drzavaSifra: z.string().trim(),
    regija: z.string().trim(),
    grad: z.string().trim(),
  })
  .transform((v, ctx): IzborDestinacije => {
    const odbij = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };

    if (v.id !== "") {
      if (!z.uuid().safeParse(v.id).success) {
        return odbij(T.greske.destinacijaObavezna);
      }
      return { id: v.id, novo: null };
    }

    // No id and no country either: nothing was chosen at all.
    if (v.drzavaSifra === "") return odbij(T.greske.destinacijaObavezna);
    // The region is optional. Povratak does not ask for one at all (it is
    // Beograd on almost every booking), and on Odlazak the box may be left
    // blank — a town with no region given becomes its own region, which is the
    // shape `Srbija › Beograd › Beograd` already has in the seed. The Server
    // Action fills it in; see `razresiDestinaciju`.
    if (v.grad === "") return odbij(T.greske.nazivMestaObavezan);
    if (v.regija.length > MAX_NAZIVA || v.grad.length > MAX_NAZIVA) {
      return odbij(T.greske.nazivPredugacak);
    }

    return {
      id: null,
      novo: { drzavaSifra: v.drzavaSifra, regija: v.regija, grad: v.grad },
    };
  });

/**
 * Upper bound on passengers.
 *
 * SPEC names no maximum, so this is a guardrail rather than a business rule:
 * without one, `2147483648` passed validation and died at Postgres on int4
 * overflow, surfacing as the generic "Čuvanje nije uspelo." The largest real
 * booking in the data is 21 — a minibus — so 100 is far above anything the
 * business runs and far below anything that breaks the column. If the owner
 * ever charters a coach, this is the one line to change.
 */
export const MAX_PUTNIKA = 100;

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

    destinacija: DestinacijaSchema,
    datumPolaska,

    destinacijaPovratka: DestinacijaSchema,
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
        // Digits only, checked BEFORE `Number()`. `Number` happily accepts
        // `1e3` (1000), `0x10` (16) and `  7  `, none of which anyone typed
        // into a passenger-count box on purpose. `Number.isInteger` does not
        // catch them, because the results really are integers.
        if (!/^\d+$/.test(v)) {
          ctx.addIssue({ code: "custom", message: T.greske.brojPutnikaNeispravan });
          return z.NEVER;
        }
        const n = Number(v);
        if (n <= 0) {
          ctx.addIssue({ code: "custom", message: T.greske.brojPutnikaNeispravan });
          return z.NEVER;
        }
        if (n > MAX_PUTNIKA) {
          ctx.addIssue({ code: "custom", message: T.greske.brojPutnikaPrevelik });
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
/**
 * One cascade's four inputs, read under their shared prefix: the id when a
 * destination was picked, and the country/region/city when one was typed.
 *
 * The cascade renders all four every time, so a missing one arrives as `""`
 * and `DestinacijaSchema` decides which combination is meaningful. Exported
 * because Podešavanja renders the same cascade for the default home town.
 */
export function mestoIzFormData(formData: FormData, prefiks: string) {
  const uzmi = (kljuc: string) => {
    const v = formData.get(kljuc);
    return typeof v === "string" ? v : "";
  };
  return {
    id: uzmi(prefiks),
    drzavaSifra: uzmi(`${prefiks}Drzava`),
    regija: uzmi(`${prefiks}Regija`),
    grad: uzmi(`${prefiks}Grad`),
  };
}

export function izFormData(formData: FormData): UlazRezervacije {
  const uzmi = (kljuc: string) => {
    const v = formData.get(kljuc);
    return typeof v === "string" ? v : "";
  };

  const mesto = (prefiks: string) => mestoIzFormData(formData, prefiks);

  return {
    ime: uzmi("ime"),
    telefon: uzmi("telefon"),
    destinacija: mesto("destinacija"),
    datumPolaska: uzmi("datumPolaska"),
    destinacijaPovratka: mesto("destinacijaPovratka"),
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
