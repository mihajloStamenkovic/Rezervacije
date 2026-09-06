"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  izmeniRezervaciju,
  obrisiRezervaciju as obrisiRed,
  rezervacijaZa,
  sveDestinacije,
  upisiRezervaciju,
} from "@/db/queries";
import { katalogZaFormu } from "@/domen/kaskada";
import { podrazumevaniTim, smeDaDodeli } from "@/domen/pristup";
import { zahtevajKorisnika } from "@/lib/auth";
import { putanjaNazad } from "@/lib/navigacija";
import { T } from "@/lib/tekst";
import {
  RezervacijaSchema,
  greskePolja,
  izFormData,
  type GreskePolja,
  type StanjeForme,
} from "@/lib/validacija";

/**
 * Create and edit, and delete below them — SPEC §6, screens 3 and 4.
 *
 * A Server Action is a public endpoint. Everything a caller could skip by not
 * using the form is therefore re-done here: the session is checked with
 * `zahtevajKorisnika` (the queries below go through Drizzle, which connects as
 * the table owner and bypasses RLS), and the payload is re-validated with the
 * same schema the browser ran. The client-side pass is a convenience; this one
 * is the rule.
 *
 * `kreirao` is never taken from the form. On create it is the logged-in user;
 * on edit it is left exactly as it was, because the column records who entered
 * the booking, not who touched it last.
 */

/** Where to send the user afterwards — the list, with their filters intact. */
function odrediste(formData: FormData): string {
  const nazad = formData.get("nazad");
  return putanjaNazad(typeof nazad === "string" ? nazad : undefined);
}

/** The sentinel the team dropdown submits for "administrators only". */
const SAMO_ADMINI = "samo-admini";

/**
 * The team the form asked for: a uuid, `null` for administrators-only, or
 * `undefined` when the field was not rendered at all.
 *
 * Three states rather than two, because "the driver's form has no team field"
 * and "the admin chose administrators-only" must not collapse into the same
 * value — one means *keep the sensible default*, the other means *hide this
 * from every driver*.
 */
function trazeniTim(formData: FormData): string | null | undefined {
  const vrednost = formData.get("tim");
  if (typeof vrednost !== "string" || vrednost === "") return undefined;
  return vrednost === SAMO_ADMINI ? null : vrednost;
}

export async function sacuvajRezervaciju(
  id: string | null,
  _prethodno: StanjeForme,
  formData: FormData,
): Promise<StanjeForme> {
  const korisnik = await zahtevajKorisnika();

  const razultat = RezervacijaSchema.safeParse(izFormData(formData));
  if (!razultat.success) {
    return { ok: false, greske: greskePolja(razultat.error) };
  }
  const podaci = razultat.data;

  /*
   * The schema can only say "that is a uuid". It cannot say "that destination
   * is still offered", because it has no database and must not grow one.
   *
   * SPEC §5 settled that Slovenija and BiH are not bookable, and the dropdowns
   * honour it — but a Server Action is a public endpoint, so a hand-built POST
   * reached straight past them until now. The foreign key still blocked an id
   * that is in no row at all; an id belonging to an INACTIVE row sailed through.
   *
   * The allowed set comes from `katalogZaFormu`, the same function the form's
   * dropdowns are built from, so the check and the UI cannot drift apart. Its
   * second argument is what keeps an existing booking editable: a reservation
   * already pointing at Ljubljana may be saved again with Ljubljana, because
   * inactive means "not offered for new bookings", never "unresolvable"
   * (SPEC §5).
   */
  const postojeca = id === null ? null : await rezervacijaZa(korisnik, id);
  if (id !== null && postojeca === null) {
    return { ok: false, greske: {}, opsta: T.greske.nijeNadjeno };
  }

  const dozvoljene = new Set(
    katalogZaFormu(await sveDestinacije(), [
      postojeca?.destinacija.id,
      postojeca?.destinacijaPovratka.id,
    ]).map((d) => d.id),
  );

  const greske: GreskePolja = {};
  if (!dozvoljene.has(podaci.destinacijaId)) {
    greske.destinacijaId = T.greske.destinacijaNijeUPonudi;
  }
  if (!dozvoljene.has(podaci.destinacijaPovratkaId)) {
    greske.destinacijaPovratkaId = T.greske.destinacijaNijeUPonudi;
  }
  if (Object.keys(greske).length > 0) return { ok: false, greske };

  /*
   * Which team may see this booking.
   *
   * The form only renders the field for an admin — a driver can file under
   * their own team and nowhere else, so asking them would be a question with
   * one answer. That makes the *absence* of the field meaningful, and it is
   * read here as "leave it as it was" on an edit and "my own team" on a new
   * booking, never as "administrators only".
   *
   * `smeDaDodeli` is then applied to whatever we arrived at, because a Server
   * Action is a public endpoint and a hand-built POST can carry any `tim` it
   * likes. Without this check the field would be a way to write into another
   * crew's schedule, or to hide a booking from your own.
   */
  const trazeni = trazeniTim(formData);
  const timId =
    trazeni !== undefined
      ? trazeni
      : id === null
        ? podrazumevaniTim(korisnik)
        : (postojeca?.rezervacija.timId ?? null);

  if (!smeDaDodeli(korisnik, timId)) {
    return { ok: false, greske: {}, opsta: T.greske.timNijeDozvoljen };
  }

  try {
    if (id === null) {
      await upisiRezervaciju({ ...podaci, kreirao: korisnik.id, timId });
    } else {
      const izmenjena = await izmeniRezervaciju(korisnik, id, {
        ...podaci,
        timId,
      });
      if (!izmenjena) {
        return { ok: false, greske: {}, opsta: T.greske.nijeNadjeno };
      }
    }
  } catch {
    // A check constraint or a foreign key that the schema did not catch. The
    // user cannot act on the detail, and the detail may name a column.
    return { ok: false, greske: {}, opsta: T.greske.neuspelo };
  }

  const kuda = odrediste(formData);
  revalidatePath("/");
  if (id !== null) revalidatePath(`/rezervacija/${id}`);
  // `redirect` throws to unwind, so it stays outside the try above.
  redirect(kuda);
}

/**
 * Permanent. There is no status column and no undo — the confirm dialog in
 * `dugme-brisanja.tsx` is the only guard, and the nightly backup is the only
 * net (SPEC §8, standing rule 6).
 */
export async function obrisiRezervaciju(
  id: string,
  formData: FormData,
): Promise<void> {
  const korisnik = await zahtevajKorisnika();

  // One statement, not a read followed by a delete: the visibility condition
  // travels in the DELETE's own WHERE, so there is no window between deciding
  // this row may be removed and removing it, and a row belonging to another
  // team simply matches nothing.
  await obrisiRed(korisnik, id);

  revalidatePath("/");
  redirect(odrediste(formData));
}
