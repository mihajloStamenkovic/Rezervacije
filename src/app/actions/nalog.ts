"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/** Signs the current session out and sends the browser back to /prijava. */
export async function odjaviSe() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/prijava");
}
