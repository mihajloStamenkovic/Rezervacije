/**
 * The body of the list — SPEC §2 and §6, screen 1.
 *
 * A Server Component with no state of its own. It is handed an already
 * resolved and already sorted `StavkaListe[]` and decides only how to break it
 * into headings.
 *
 * **Day headings follow the sort, not the mode.** Grouping by day is only
 * meaningful while the list is in date order; sorted by destination the dates
 * are scattered, and `grupisiPoDanu` — which starts a new group whenever the
 * date changes — would emit a column of one-row groups. So in that case the
 * list goes flat and each card carries its own date instead.
 *
 * **Dan mode adds the Polasci / Povratci split** inside each day, which is the
 * SPEC §2 answer to "what happens on 01.01.2026". The split is only drawn when
 * a day actually holds both; a heading over the only kind of row there is says
 * nothing. The order itself is not decided here — `sortirajStavke` has already
 * put departures before returns.
 */
import { KarticaRezervacije } from "@/components/kartica-rezervacije";
import { grupisiPoDanu, grupisiPoSmeru } from "@/domen/liste";
import type { RezimPrikaza, Sortiranje, StavkaListe } from "@/domen/tipovi";
import { naslovDana, type Datum } from "@/lib/datum";
import { T } from "@/lib/tekst";

export function ListaRezervacija({
  stavke,
  rezim,
  sort,
  danas,
  povratak,
}: {
  stavke: StavkaListe[];
  rezim: RezimPrikaza;
  sort: Sortiranje;
  danas: Datum;
  povratak: string;
}) {
  if (stavke.length === 0) return null;

  if (sort.polje !== "datum") {
    return (
      <ul className="flex flex-col gap-2">
        {stavke.map((s) => (
          <li key={s.kljuc}>
            <KarticaRezervacije stavka={s} povratak={povratak} prikaziDatum />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {grupisiPoDanu(stavke).map((grupa) => (
        <section key={grupa.datum}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {naslovDana(grupa.datum, danas)}
          </h2>
          {rezim === "dan" ? (
            <DanSaSmerovima stavke={grupa.stavke} povratak={povratak} />
          ) : (
            <Kartice stavke={grupa.stavke} povratak={povratak} />
          )}
        </section>
      ))}
    </div>
  );
}

function DanSaSmerovima({
  stavke,
  povratak,
}: {
  stavke: StavkaListe[];
  povratak: string;
}) {
  const { polasci, povratci } = grupisiPoSmeru(stavke);

  // Only one kind of leg on this day — the direction chips on the cards
  // already say which, so a subheading would be noise.
  if (polasci.length === 0 || povratci.length === 0) {
    return <Kartice stavke={stavke} povratak={povratak} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {T.grupa.polasci}
        </h3>
        <Kartice stavke={polasci} povratak={povratak} />
      </div>
      <div>
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {T.grupa.povratci}
        </h3>
        <Kartice stavke={povratci} povratak={povratak} />
      </div>
    </div>
  );
}

function Kartice({
  stavke,
  povratak,
}: {
  stavke: StavkaListe[];
  povratak: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {stavke.map((s) => (
        <li key={s.kljuc}>
          <KarticaRezervacije stavka={s} povratak={povratak} />
        </li>
      ))}
    </ul>
  );
}
