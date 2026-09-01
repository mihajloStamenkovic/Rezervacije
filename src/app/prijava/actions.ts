"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { profilPoId } from "@/db/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { T } from "@/lib/tekst";

const PrijavaSchema = z.object({
  email: z.string().trim().min(1),
  lozinka: z.string().min(1),
});

export type PrijavaStanje = { greska: string } | undefined;

/**
 * One generic error whether the field validation failed, the email is
 * unknown, the password is wrong, or the account is not on the access list —
 * never reveal which of them was the problem (agent brief, "The login
 * screen"). The last case matters most: a distinct "you are not authorised"
 * would confirm to a stranger that their credentials are otherwise valid.
 */
export async function prijaviSe(
  _prethodnoStanje: PrijavaStanje,
  formData: FormData,
): Promise<PrijavaStanje> {
  const polja = PrijavaSchema.safeParse({
    email: formData.get("email"),
    lozinka: formData.get("lozinka"),
  });

  if (!polja.success) {
    return { greska: T.prijava.greska };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: polja.data.email,
    password: polja.data.lozinka,
  });

  if (error || !data.user) {
    return { greska: T.prijava.greska };
  }

  /**
   * Correct credentials are not the same as permission to be here.
   *
   * Supabase Auth owns the password and has just confirmed it. Whether this
   * account may use the app is a separate question with a separate answer: a
   * row in `profiles` (migration 0003). Signups are switched off in the
   * dashboard too, but an account can also arrive by being created there and
   * never given a profile, so the app checks rather than assumes.
   *
   * The session that `signInWithPassword` just minted is revoked before
   * returning. A Server Action *can* write cookies, unlike a Server
   * Component, so this is the one place the stray session can actually be
   * cleaned up instead of merely refused.
   */
  const profil = await profilPoId(data.user.id);
  if (!profil) {
    await supabase.auth.signOut();
    return { greska: T.prijava.greska };
  }

  redirect("/");
}
