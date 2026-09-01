"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  izmeniRezervaciju,
  obrisiRezervaciju as obrisiRed,
  rezervacijaPoId,
  upisiRezervaciju,
} from "@/db/queries";
import { zahtevajKorisnika } from "@/lib/auth";
import { putanjaNazad } from "@/lib/navigacija";
import { T } from "@/lib/tekst";
import {
  RezervacijaSchema,
  greskePolja,
  izFormData,
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

  try {
    if (id === null) {
      await upisiRezervaciju({ ...podaci, kreirao: korisnik.id });
    } else {
      const izmenjena = await izmeniRezervaciju(id, podaci);
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
  await zahtevajKorisnika();

  const postoji = await rezervacijaPoId(id);
  if (postoji) await obrisiRed(id);

  revalidatePath("/");
  redirect(odrediste(formData));
}
