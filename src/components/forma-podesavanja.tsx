"use client";

/**
 * The one setting there is: the default home destination.
 *
 * It reuses the reservation form's cascade rather than a flat list of 44
 * cities, so choosing "Beograd" is the same three taps here as it is when
 * entering a booking — including *Drugo — upiši ručno*, since a home town that
 * is not in the list is exactly as plausible as a destination that is not.
 */
import { useActionState, useState } from "react";
import {
  KaskadaDestinacija,
  type Odabir,
} from "@/components/kaskada-destinacija";
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
  const [destinacija, postaviDestinaciju] = useState<Odabir>(() => ({
    id: pocetna,
    novo: null,
  }));

  /** Nothing to save until a city has been picked, or typed in full. */
  const spremno =
    destinacija.id !== null ||
    (destinacija.novo !== null &&
      destinacija.novo.regija.trim() !== "" &&
      destinacija.novo.grad.trim() !== "");

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      /* Same reason as the reservation form: React's post-action reset would
         blank the cascade's `<select>`s while its state still holds the
         chosen town. Everything here is controlled. */
      onReset={(e) => e.preventDefault()}
    >
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
        naziv="destinacija"
        katalog={katalog}
        vrednost={destinacija}
        onChange={postaviDestinaciju}
        greska={stanje && !stanje.ok ? stanje.greska : undefined}
        disabled={uToku}
      />

      {stanje?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {stanje.poruka}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={uToku || !spremno}
        className="h-12 text-base"
      >
        {uToku ? T.forma.cuvanje : T.forma.sacuvaj}
      </Button>
    </form>
  );
}
