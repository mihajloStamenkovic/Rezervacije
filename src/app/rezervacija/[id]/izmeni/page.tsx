/**
 * Izmeni rezervaciju — the same form as Nova, seeded from the stored row.
 *
 * The catalogue here is the active destinations **plus** whatever this booking
 * already points at. Without that second half, opening the Ljubljana booking
 * after Slovenija was marked unavailable would show an empty cascade and
 * saving would silently move the trip somewhere else (SPEC §5, "Inactive
 * destinations must still resolve").
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { FormaRezervacije } from "@/components/forma-rezervacije";
import { rezervacijaPoId, sveDestinacije } from "@/db/queries";
import { katalogZaFormu } from "@/domen/kaskada";
import { zahtevajKorisnika } from "@/lib/auth";
import { zaInput } from "@/lib/datum";
import { putanjaNazad } from "@/lib/navigacija";
import { T } from "@/lib/tekst";

export default async function Izmeni({
  params,
  searchParams,
}: PageProps<"/rezervacija/[id]/izmeni">) {
  await zahtevajKorisnika();

  const { id } = await params;
  const nazad = putanjaNazad(
    (await searchParams).nazad,
    `/rezervacija/${id}`,
  );

  const [red, sve] = await Promise.all([
    rezervacijaPoId(id),
    sveDestinacije(),
  ]);
  if (!red) notFound();

  const { rezervacija } = red;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href={`/rezervacija/${id}?nazad=${encodeURIComponent(nazad)}`}
          aria-label={T.nav.nazad}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{T.forma.naslovIzmena}</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        <FormaRezervacije
          id={rezervacija.id}
          katalog={katalogZaFormu(sve, [
            rezervacija.destinacijaId,
            rezervacija.destinacijaPovratkaId,
          ])}
          nazad={`/rezervacija/${id}?nazad=${encodeURIComponent(nazad)}`}
          jednosmernoPocetno={rezervacija.datumPovratka === null}
          pocetna={{
            ime: rezervacija.ime,
            telefon: rezervacija.telefon,
            destinacijaId: rezervacija.destinacijaId,
            datumPolaska: zaInput(rezervacija.datumPolaska),
            destinacijaPovratkaId: rezervacija.destinacijaPovratkaId,
            datumPovratka: zaInput(rezervacija.datumPovratka),
            brojPutnika: String(rezervacija.brojPutnika),
          }}
        />
      </main>
    </div>
  );
}
