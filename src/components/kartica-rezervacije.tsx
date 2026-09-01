/**
 * One row of the list (SPEC §6, screen 1).
 *
 * It renders a `StavkaListe` — a *leg*, not a reservation. That distinction is
 * the whole point of the domain layer: in Dan mode a same-day round trip
 * produces two of these cards for one booking, one departure and one return,
 * each showing its own date and its own destination. The card never re-derives
 * which leg to show; it is told.
 *
 * `stavka.kljuc` (`<id>#<smer>`) is the React key the caller must use — the
 * reservation id alone is not unique here.
 */
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { BedzAutora } from "@/components/bedz-autora";
import { CipSmera } from "@/components/cip-smera";
import { imeDestinacije } from "@/domen/destinacije";
import type { StavkaListe } from "@/domen/tipovi";
import { formatDatum } from "@/lib/datum";
import { T, putnika } from "@/lib/tekst";

export function KarticaRezervacije({
  stavka,
  povratak,
  prikaziDatum = false,
}: {
  stavka: StavkaListe;
  /** Where the detail screen should send the user back to — the filtered list. */
  povratak: string;
  /**
   * Sorted by destination there are no day headings to read the date off, so
   * the card carries its own. Under a day heading it would just repeat it.
   */
  prikaziDatum?: boolean;
}) {
  const { rezervacija, autor } = stavka.red;

  return (
    <Link
      href={`/rezervacija/${rezervacija.id}?nazad=${encodeURIComponent(povratak)}`}
      // min-h-16 keeps the whole card well past the 44px touch target even
      // when a name is short enough to wrap to one line.
      className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors active:bg-muted hover:bg-muted/60"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{rezervacija.ime}</span>
          <BedzAutora autor={autor} className="ml-auto" />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <CipSmera smer={stavka.smer} />
          <span className="truncate">{imeDestinacije(stavka.destinacija)}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{putnika(rezervacija.brojPutnika)}</span>
        </div>
        {prikaziDatum ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDatum(stavka.datum)}
          </span>
        ) : null}
      </div>
      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="sr-only">{T.lista.otvori}</span>
    </Link>
  );
}
