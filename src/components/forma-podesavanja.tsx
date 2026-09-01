"use client";

/**
 * The one setting there is: the default home destination.
 *
 * It reuses the reservation form's cascade rather than a flat list of 44
 * cities, so choosing "Beograd" is the same three taps here as it is when
 * entering a booking.
 */
import { useActionState, useState } from "react";
import { KaskadaDestinacija } from "@/components/kaskada-destinacija";
import { Button } from "@/components/ui/button";
import {
  sacuvajPodrazumevanuDestinaciju,
  type StanjePodesavanja,
} from "@/app/actions/podesavanja";
import type { Destinacija } from "@/domen/tipovi";
import { T } from "@/lib/tekst";

export function FormaPodesavanja({
  katalog,
  pocetna,
}: {
  katalog: Destinacija[];
  pocetna: string | null;
}) {
  const [stanje, action, uToku] = useActionState<StanjePodesavanja, FormData>(
    sacuvajPodrazumevanuDestinaciju,
    undefined,
  );
  const [destinacijaId, postaviDestinaciju] = useState(pocetna);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-medium">
          {T.podesavanja.podrazumevaniGrad}
        </h2>
        <p className="text-sm text-muted-foreground">
          {T.podesavanja.podrazumevaniGradPomoc}
        </p>
      </div>

      <KaskadaDestinacija
        idPolja="podrazumevana"
        naziv="destinacijaId"
        katalog={katalog}
        vrednost={destinacijaId}
        onChange={postaviDestinaciju}
        greska={stanje && !stanje.ok ? stanje.greska : undefined}
      />

      {stanje?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {stanje.poruka}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={uToku || !destinacijaId}
        className="h-12 text-base"
      >
        {uToku ? T.forma.cuvanje : T.forma.sacuvaj}
      </Button>
    </form>
  );
}
