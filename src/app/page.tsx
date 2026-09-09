/**
 * Lista — the home screen (SPEC §6, screen 1).
 *
 * This is where `danasBeograd()` is called: once, at the edge, and then passed
 * down. Nothing below this line reads a clock, which is what keeps the two
 * accounts looking at the same list from two countries (SPEC §7, standing
 * rule 5).
 *
 * Filter and search arrive in `searchParams` and are handed straight to
 * `prikaziListu`, which picks the mode and does the work. No filtering, no
 * sorting and no leg reasoning happens in this file or below it. The order is
 * fixed — by date, soonest first — since the sort controls were removed.
 *
 * **Both tabs are rendered here, always** (SPEC §2, amended 09.09.2026).
 * `prikaziListu` hands back the departures and the returns from one pass over
 * the rows, and `PanelTabova` swipes between two lists that are already on the
 * page — so changing tab costs no request and works offline.
 */
import Link from "next/link";
import { SettingsIcon } from "lucide-react";
import { FilterSheet } from "@/components/filter-sheet";
import { ListaRezervacija } from "@/components/lista-rezervacija";
import { PoljePretrage } from "@/components/polje-pretrage";
import {
  DugmeNove,
  PanelTabova,
  TaboviListe,
  TrakaTabova,
} from "@/components/tabovi-liste";
import { sveDestinacije, rezervacijeZa } from "@/db/queries";
import { destinacijeZaFilter, stabloDestinacija } from "@/domen/destinacije";
import { prikaziListu } from "@/domen/liste";
import type { RezimPrikaza, Smer, StavkaListe } from "@/domen/tipovi";
import { zahtevajKorisnika } from "@/lib/auth";
import { danasBeograd, formatDatum, type Datum } from "@/lib/datum";
import { T } from "@/lib/tekst";
import { procitajStanjeUrl, putanjaListe } from "@/lib/url-stanje";

const NASLOV = {
  raspored: T.lista.naslov,
  dan: T.lista.naslovDan,
  pretraga: T.lista.naslovPretraga,
} as const;

export default async function Lista({ searchParams }: PageProps<"/">) {
  const korisnik = await zahtevajKorisnika();

  const danas = danasBeograd();
  const stanje = procitajStanjeUrl(await searchParams);

  // Scoped to what this person may see before the domain core ever sees a row:
  // the list modes decide *which* of your bookings show, never *whose*.
  const [redovi, katalog] = await Promise.all([
    rezervacijeZa(korisnik),
    sveDestinacije(),
  ]);

  const { rezim, odlasci, povratci } = prikaziListu(redovi, {
    danas,
    opseg: stanje.opseg,
    destinacije: stanje.destinacije,
    pretraga: stanje.pretraga,
    katalog,
  });

  // Everything offerable today, plus anything an existing booking points at —
  // so the Ljubljana booking stays findable after Slovenija went inactive
  // (SPEC §5).
  const stablo = stabloDestinacija(destinacijeZaFilter(katalog, redovi));

  // Each panel sends its cards back to its own tab, so returning from Detalji
  // lands where you left. Built per panel rather than from the open tab: a
  // swipe changes the tab without re-rendering this file.
  const nazad: Record<Smer, string> = {
    odlazak: putanjaListe({ ...stanje, tab: "odlazak" }),
    povratak: putanjaListe({ ...stanje, tab: "povratak" }),
  };

  const imaFilter = stanje.destinacije.length > 0 || stanje.opseg !== null;

  return (
    <div className="flex min-h-svh flex-col">
      <TaboviListe stanje={stanje}>
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

          <TrakaTabova
            brojevi={{ odlazak: odlasci.length, povratak: povratci.length }}
          />
        </header>

        {/* pb-28 clears the fixed action bar; without it the last card is
            unreachable behind it. */}
        <main className="flex-1 pt-3 pb-28">
          <PanelTabova
            odlasci={
              <Panel
                stavke={odlasci}
                smer="odlazak"
                rezim={rezim}
                imaFilter={imaFilter}
                danas={danas}
                povratak={nazad.odlazak}
              />
            }
            povratci={
              <Panel
                stavke={povratci}
                smer="povratak"
                rezim={rezim}
                imaFilter={imaFilter}
                danas={danas}
                povratak={nazad.povratak}
              />
            }
          />
        </main>

        <DugmeNove stanje={stanje} />
      </TaboviListe>
    </div>
  );
}

/** One tab's worth of list, or the reason it is empty. */
function Panel({
  stavke,
  smer,
  rezim,
  imaFilter,
  danas,
  povratak,
}: {
  stavke: StavkaListe[];
  smer: Smer;
  rezim: RezimPrikaza;
  imaFilter: boolean;
  danas: Datum;
  povratak: string;
}) {
  if (stavke.length === 0) {
    return (
      <p className="mt-12 px-4 text-center text-sm text-muted-foreground">
        {prazno(rezim, smer, imaFilter)}
      </p>
    );
  }

  return (
    <div className="px-4">
      <ListaRezervacija
        stavke={stavke}
        danas={danas}
        povratak={povratak}
      />
    </div>
  );
}

/**
 * Six silences, and which one this is depends on both the tab and why it is
 * empty — "there are no departures" is a much narrower thing to say than
 * "there is nothing", and while the other tab has rows in it, it is the only
 * true one.
 */
function prazno(rezim: RezimPrikaza, smer: Smer, imaFilter: boolean): string {
  if (rezim === "pretraga") return T.lista.prazno[smer].pretraga;
  return imaFilter ? T.lista.prazno[smer].filter : T.lista.prazno[smer].raspored;
}
