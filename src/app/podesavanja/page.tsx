/**
 * Podešavanja — one field, plus the way out (SPEC §6).
 *
 * The default home destination is kept as the *active* catalogue only: unlike
 * the edit form there is no existing booking to preserve here, and offering a
 * destination the client no longer serves as the standing default would seed
 * it into every future booking.
 */
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { odjaviSe } from "@/app/actions/nalog";
import { FormaPodesavanja } from "@/components/forma-podesavanja";
import { Button } from "@/components/ui/button";
import { podesavanja, sveDestinacije } from "@/db/queries";
import { katalogZaFormu } from "@/domen/kaskada";
import { zahtevajKorisnika } from "@/lib/auth";
import { T } from "@/lib/tekst";

export default async function Podesavanja() {
  await zahtevajKorisnika();

  const [sve, postavke] = await Promise.all([sveDestinacije(), podesavanja()]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href="/"
          aria-label={T.nav.nazad}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{T.podesavanja.naslov}</h1>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-4">
        <FormaPodesavanja
          katalog={katalogZaFormu(sve)}
          pocetna={postavke?.podrazumevanaDestinacijaId ?? null}
        />

        <form action={odjaviSe} className="mt-auto">
          <Button
            type="submit"
            variant="outline"
            className="h-12 w-full text-base"
          >
            {T.prijava.odjava}
          </Button>
        </form>
      </main>
    </div>
  );
}
