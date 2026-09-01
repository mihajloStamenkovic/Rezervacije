"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { postaviPodrazumevanuDestinaciju } from "@/db/queries";
import { zahtevajKorisnika } from "@/lib/auth";
import { T } from "@/lib/tekst";

/**
 * Podešavanja — one field, the default home destination (SPEC §6).
 *
 * It does not redirect. The only thing to say afterwards is "saved", and
 * bouncing the owner back to the list to prove it would lose the screen he is
 * standing on. `revalidatePath("/nova")` is the part that matters: the new
 * booking form reads this row to pre-fill the return leg.
 */
export type StanjePodesavanja =
  | { ok: true; poruka: string }
  | { ok: false; greska: string }
  | undefined;

const Schema = z.object({
  destinacijaId: z.uuid({ message: T.greske.destinacijaObavezna }),
});

export async function sacuvajPodrazumevanuDestinaciju(
  _prethodno: StanjePodesavanja,
  formData: FormData,
): Promise<StanjePodesavanja> {
  await zahtevajKorisnika();

  const polja = Schema.safeParse({
    destinacijaId: formData.get("destinacijaId") ?? "",
  });
  if (!polja.success) {
    return { ok: false, greska: T.greske.destinacijaObavezna };
  }

  try {
    await postaviPodrazumevanuDestinaciju(polja.data.destinacijaId);
  } catch {
    return { ok: false, greska: T.greske.neuspelo };
  }

  revalidatePath("/nova");
  revalidatePath("/podesavanja");
  return { ok: true, poruka: T.podesavanja.sacuvano };
}
