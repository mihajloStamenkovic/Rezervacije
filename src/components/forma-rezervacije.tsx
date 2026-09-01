"use client";

/**
 * Nova / Izmeni rezervaciju — SPEC §6, screen 3.
 *
 * **Every field is controlled.** React resets an uncontrolled form once its
 * action resolves, and this action resolves without navigating whenever
 * validation fails — which would hand back an empty form as the reward for a
 * mistyped phone number. Controlled state is what makes a rejected submission
 * keep everything the user typed.
 *
 * The two destination ids live here rather than inside the cascades because
 * the ⇅ swap has to move both at once, and because they are what the form
 * actually submits — the country and region selects are only the path to them.
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowUpDownIcon } from "lucide-react";
import { KaskadaDestinacija } from "@/components/kaskada-destinacija";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sacuvajRezervaciju } from "@/app/actions/rezervacije";
import type { Destinacija } from "@/domen/tipovi";
import { T } from "@/lib/tekst";
import type { GreskePolja, StanjeForme } from "@/lib/validacija";

export type PocetnaRezervacija = {
  ime: string;
  telefon: string;
  destinacijaId: string | null;
  datumPolaska: string;
  destinacijaPovratkaId: string | null;
  datumPovratka: string;
  brojPutnika: string;
};

export function FormaRezervacije({
  id,
  katalog,
  pocetna,
  nazad,
}: {
  /** `null` for a new booking, the reservation id when editing. */
  id: string | null;
  katalog: Destinacija[];
  pocetna: PocetnaRezervacija;
  nazad: string;
}) {
  const [stanje, action, uToku] = useActionState<StanjeForme, FormData>(
    sacuvajRezervaciju.bind(null, id),
    undefined,
  );

  const [ime, postaviIme] = useState(pocetna.ime);
  const [telefon, postaviTelefon] = useState(pocetna.telefon);
  const [brojPutnika, postaviBrojPutnika] = useState(pocetna.brojPutnika);
  const [datumPolaska, postaviDatumPolaska] = useState(pocetna.datumPolaska);
  const [datumPovratka, postaviDatumPovratka] = useState(pocetna.datumPovratka);
  const [odrediste, postaviOdrediste] = useState(pocetna.destinacijaId);
  const [povratak, postaviPovratak] = useState(pocetna.destinacijaPovratkaId);

  const greske: GreskePolja =
    stanje && !stanje.ok ? stanje.greske : {};

  /**
   * SPEC §5: one tap to enter a homecoming-first booking. It swaps the two
   * *destinations* and leaves the dates alone — the dates are what the owner
   * has just been told on the phone, and a departure date is a departure date
   * whichever way the van is pointing.
   */
  function zameni() {
    postaviOdrediste(povratak);
    postaviPovratak(odrediste);
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="nazad" value={nazad} />

      <Polje id="ime" oznaka={T.forma.ime} greska={greske.ime}>
        <Input
          id="ime"
          name="ime"
          value={ime}
          onChange={(e) => postaviIme(e.target.value)}
          placeholder={T.forma.imePlaceholder}
          autoComplete="name"
          enterKeyHint="next"
          disabled={uToku}
          aria-invalid={greske.ime ? true : undefined}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje
        id="telefon"
        oznaka={T.forma.telefon}
        pomoc={T.forma.telefonPomoc}
        greska={greske.telefon}
      >
        <Input
          id="telefon"
          name="telefon"
          type="tel"
          inputMode="tel"
          value={telefon}
          onChange={(e) => postaviTelefon(e.target.value)}
          placeholder={T.forma.telefonPlaceholder}
          autoComplete="tel"
          disabled={uToku}
          aria-invalid={greske.telefon ? true : undefined}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje
        id="brojPutnika"
        oznaka={T.forma.brojPutnika}
        greska={greske.brojPutnika}
      >
        <Input
          id="brojPutnika"
          name="brojPutnika"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={brojPutnika}
          onChange={(e) => postaviBrojPutnika(e.target.value)}
          disabled={uToku}
          aria-invalid={greske.brojPutnika ? true : undefined}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Odeljak naslov={T.forma.odlazak}>
        <KaskadaDestinacija
          idPolja="odlazak"
          naziv="destinacijaId"
          katalog={katalog}
          vrednost={odrediste}
          onChange={postaviOdrediste}
          greska={greske.destinacijaId}
        />
        <Polje
          id="datumPolaska"
          oznaka={T.forma.datumPolaska}
          greska={greske.datumPolaska}
        >
          <Input
            id="datumPolaska"
            name="datumPolaska"
            type="date"
            value={datumPolaska}
            onChange={(e) => postaviDatumPolaska(e.target.value)}
            disabled={uToku}
            aria-invalid={greske.datumPolaska ? true : undefined}
            className="h-11 text-base md:text-base"
          />
        </Polje>
      </Odeljak>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={zameni}
          disabled={uToku}
          aria-label={T.forma.zameni}
          className="size-11 rounded-full p-0"
        >
          <ArrowUpDownIcon className="size-5" />
        </Button>
      </div>

      <Odeljak naslov={T.forma.povratak}>
        <KaskadaDestinacija
          idPolja="povratak"
          naziv="destinacijaPovratkaId"
          katalog={katalog}
          vrednost={povratak}
          onChange={postaviPovratak}
          greska={greske.destinacijaPovratkaId}
        />
        <Polje
          id="datumPovratka"
          oznaka={T.forma.datumPovratka}
          pomoc={T.forma.datumPovratkaPomoc}
          greska={greske.datumPovratka}
        >
          <Input
            id="datumPovratka"
            name="datumPovratka"
            type="date"
            value={datumPovratka}
            // A departure is the earliest a return can be; the same rule is
            // enforced again in the schema and by a check constraint.
            min={datumPolaska || undefined}
            onChange={(e) => postaviDatumPovratka(e.target.value)}
            disabled={uToku}
            aria-invalid={greske.datumPovratka ? true : undefined}
            className="h-11 text-base md:text-base"
          />
        </Polje>
      </Odeljak>

      {stanje && !stanje.ok && stanje.opsta ? (
        <p role="alert" className="text-sm text-destructive">
          {stanje.opsta}
        </p>
      ) : null}

      {/* Primary action in the bottom third, clear of the home indicator. */}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button asChild variant="outline" className="h-12 flex-1 text-base">
          <Link href={nazad}>{T.forma.odustani}</Link>
        </Button>
        <Button type="submit" disabled={uToku} className="h-12 flex-1 text-base">
          {uToku ? T.forma.cuvanje : T.forma.sacuvaj}
        </Button>
      </div>
    </form>
  );
}

function Odeljak({
  naslov,
  children,
}: {
  naslov: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{naslov}</legend>
      {children}
    </fieldset>
  );
}

function Polje({
  id,
  oznaka,
  pomoc,
  greska,
  children,
}: {
  id: string;
  oznaka: string;
  pomoc?: string;
  greska?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {oznaka}
      </label>
      {children}
      {greska ? (
        <p role="alert" className="text-sm text-destructive">
          {greska}
        </p>
      ) : pomoc ? (
        <p className="text-sm text-muted-foreground">{pomoc}</p>
      ) : null}
    </div>
  );
}
