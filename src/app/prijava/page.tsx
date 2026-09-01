import { redirect } from "next/navigation";
import { CiscenjeKesa } from "@/components/ciscenje-kesa";
import { supabaseServer } from "@/lib/supabase/server";
import { T } from "@/lib/tekst";
import { PrijavaForma } from "./prijava-forma";

export const metadata = {
  title: `${T.prijava.naslov} — ${T.app.naziv}`,
};

export default async function PrijavaPage() {
  // Defense in depth alongside src/proxy.ts: an already-authenticated
  // browser that lands here directly (e.g. a stale bookmark) goes straight
  // through instead of being shown a login form it does not need.
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      {/* Reaching this screen means signed out or not signed in yet — either
          way, no cached booking should survive it. */}
      <CiscenjeKesa />
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">
          {T.prijava.naslov}
        </h1>
        <PrijavaForma />
      </div>
    </main>
  );
}
