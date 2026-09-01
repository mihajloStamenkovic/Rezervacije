"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { T } from "@/lib/tekst";

const PrijavaSchema = z.object({
  email: z.string().trim().min(1),
  lozinka: z.string().min(1),
});

export type PrijavaStanje = { greska: string } | undefined;

/**
 * One generic error whether the field validation failed, the email is
 * unknown, or the password is wrong — never reveal which half of the
 * credentials was the problem (agent brief, "The login screen").
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
  const { error } = await supabase.auth.signInWithPassword({
    email: polja.data.email,
    password: polja.data.lozinka,
  });

  if (error) {
    return { greska: T.prijava.greska };
  }

  redirect("/");
}
