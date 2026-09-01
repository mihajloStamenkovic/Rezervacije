/**
 * Lista — the home screen (SPEC §6, screen 1).
 *
 * This is where `danasBeograd()` is called: once, at the edge, and then passed
 * down. Nothing below this line reads a clock, which is what keeps the two
 * accounts looking at the same list from two countries (SPEC §7, standing
 * rule 5).
 *
 * Filter, sort and search arrive in `searchParams` and are handed straight to
 * `prikaziListu`, which picks the mode and does the work. No filtering, no
 * sorting and no main-leg reasoning happens in this file or below it.
 */
import Link from "next/link";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { FilterSheet } from "@/components/filter-sheet";
import { ListaRezervacija } from "@/components/lista-rezervacija";
import { PoljePretrage } from "@/components/polje-pretrage";
import { Button } from "@/components/ui/button";
import { sveDestinacije, sveRezervacije } from "@/db/queries";
import { destinacijeZaFilter, stabloDestinacija } from "@/domen/destinacije";
import { prikaziListu } from "@/domen/liste";
import { zahtevajKorisnika } from "@/lib/auth";
import { danasBeograd, formatDatum } from "@/lib/datum";
import { T, rezervacija as rezervacijaBroj } from "@/lib/tekst";
import { procitajStanjeUrl, putanjaListe } from "@/lib/url-stanje";

const NASLOV = {
  raspored: T.lista.naslov,
  dan: T.lista.naslovDan,
  pretraga: T.lista.naslovPretraga,
} as const;

export default async function Lista({ searchParams }: PageProps<"/">) {
  await zahtevajKorisnika();

  const danas = danasBeograd();
  const stanje = procitajStanjeUrl(await searchParams);

  const [redovi, katalog] = await Promise.all([
    sveRezervacije(),
    sveDestinacije(),
  ]);

  const { rezim, stavke } = prikaziListu(redovi, {
    danas,
    opseg: stanje.opseg,
    destinacije: stanje.destinacije,
    pretraga: stanje.pretraga,
    sort: stanje.sort,
    katalog,
  });

  // Everything offerable today, plus anything an existing booking points at —
  // so the Ljubljana booking stays findable after Slovenija went inactive
  // (SPEC §5).
  const stablo = stabloDestinacija(destinacijeZaFilter(katalog, redovi));
  const povratak = putanjaListe(stanje);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <h1 className="text-xl font-semibold">{NASLOV[rezim]}</h1>
          {stanje.opseg ? (
            <span className="truncate text-sm text-muted-foreground">
              {formatDatum(stanje.opseg.od)}
              {stanje.opseg.do !== stanje.opseg.od
                ? ` – ${formatDatum(stanje.opseg.do)}`
                : null}
            </span>
          ) : null}
          <Link
            href="/podesavanja"
            aria-label={T.nav.podesavanja}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
          >
            <SettingsIcon className="size-5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <PoljePretrage stanje={stanje} />
          <FilterSheet stablo={stablo} stanje={stanje} danas={danas} />
        </div>
      </header>

      {/* pb-28 clears the fixed action bar; without it the last card is
          unreachable behind it. */}
      <main className="flex-1 px-4 pt-3 pb-28">
        {stavke.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            {prazno(rezim, stanje.destinacije.length > 0 || stanje.opseg !== null)}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {rezervacijaBroj(stavke.length)}
            </p>
            <ListaRezervacija
              stavke={stavke}
              rezim={rezim}
              sort={stanje.sort}
              danas={danas}
              povratak={povratak}
            />
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button asChild className="h-12 w-full gap-2 text-base">
          <Link href={`/nova?nazad=${encodeURIComponent(povratak)}`}>
            <PlusIcon className="size-5" />
            {T.lista.novaRezervacija}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Three different silences, three different reasons. */
function prazno(rezim: string, imaFilter: boolean): string {
  if (rezim === "pretraga") return T.lista.praznoPretraga;
  return imaFilter ? T.lista.prazoUzFilter : T.lista.prazno;
}
