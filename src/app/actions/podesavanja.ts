"use server";

import { revalidatePath } from "next/cache";
import {
  postaviPodrazumevanuDestinaciju,
  sveDestinacije,
} from "@/db/queries";
import { razresiDestinaciju } from "@/db/rucne-destinacije";
import { zahtevajAdmina } from "@/lib/auth";
import { T } from "@/lib/tekst";
import { DestinacijaSchema, mestoIzFormData } from "@/lib/validacija";

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

export async function sacuvajPodrazumevanuDestinaciju(
  _prethodno: StanjePodesavanja,
  formData: FormData,
): Promise<StanjePodesavanja> {
  // Admins only, since migration 0004. `settings` is a single shared row —
  // there is a `check (id = 1)` guaranteeing it — so a driver changing the
  // default home town would change it for every other crew as well. Nobody
  // asked for that, and it is the kind of cross-team effect that is hard to
  // even notice, let alone attribute.
  await zahtevajAdmina();

  const polje = DestinacijaSchema.safeParse(
    mestoIzFormData(formData, "destinacija"),
  );
  if (!polje.success) {
    return {
      ok: false,
      greska: polje.error.issues[0]?.message ?? T.greske.destinacijaObavezna,
    };
  }

  /*
   * The home town goes through the same cascade as a booking's, so it can be
   * typed by hand too, and the same resolver turns it into a row. Every
   * destination is allowed here rather than only the active ones: this is not
   * a booking, and an owner whose crews sleep in a town the client no longer
   * advertises is still entitled to set it as home.
   */
  const katalog = await sveDestinacije();
  const razresena = await razresiDestinaciju(
    polje.data,
    katalog,
    new Set(katalog.map((d) => d.id)),
  );
  if ("greska" in razresena) {
    return { ok: false, greska: razresena.greska };
  }

  try {
    await postaviPodrazumevanuDestinaciju(razresena.id);
  } catch {
    return { ok: false, greska: T.greske.neuspelo };
  }

  revalidatePath("/nova");
  revalidatePath("/podesavanja");
  return { ok: true, poruka: T.podesavanja.sacuvano };
}
