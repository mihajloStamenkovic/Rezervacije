/**
 * Nova rezervacija — SPEC §6, screen 3.
 *
 * The return destination pre-fills from the settings row (`Srbija › Beograd ›
 * Beograd` unless it has been changed) and stays editable, because the owner
 * also books one-way rides *home*, where Belgrade is the outbound leg and the
 * ⇅ swap is how you get there in one tap.
 *
 * Two fields are deliberately left blank rather than given a plausible
 * default. The departure date, because a booking that silently departs today
 * is a dispatch failure that looks like a filled-in form. And the passenger
 * count, because a silent `1` where the answer was `4` is the same mistake
 * with a van too small for it. An empty field asks a question; a wrong default
 * answers it.
 */
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { FormaRezervacije } from "@/components/forma-rezervacije";
import { podesavanja, sveDestinacije } from "@/db/queries";
import { katalogZaFormu } from "@/domen/kaskada";
import { zahtevajKorisnika } from "@/lib/auth";
import { T } from "@/lib/tekst";
import { putanjaNazad } from "@/lib/navigacija";

export default async function Nova({ searchParams }: PageProps<"/nova">) {
  await zahtevajKorisnika();

  const nazad = putanjaNazad((await searchParams).nazad);
  const [sve, postavke] = await Promise.all([sveDestinacije(), podesavanja()]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href={nazad}
          aria-label={T.nav.nazad}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{T.forma.naslovNova}</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        <FormaRezervacije
          id={null}
          katalog={katalogZaFormu(sve)}
          nazad={nazad}
          pocetna={{
            ime: "",
            telefon: "",
            destinacijaId: null,
            datumPolaska: "",
            destinacijaPovratkaId: postavke?.podrazumevanaDestinacijaId ?? null,
            datumPovratka: "",
            brojPutnika: "",
          }}
        />
      </main>
    </div>
  );
}
