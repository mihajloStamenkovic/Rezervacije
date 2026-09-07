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
 * The two destination selections live here rather than inside the cascades
 * because the ⇅ swap has to move both at once, and because they are what the
 * form actually submits — the country and region selects are only the path to
 * them. A selection is an id picked from the list *or* a place typed by hand
 * (SPEC §5, amended 06.09.2026); the swap moves either kind.
 *
 * **Jednosmerno** is a view over the same two columns, not a tenth one. A
 * booking with no return date is already a one-way (SPEC §8, "return leg
 * optional"); the checkbox makes that sayable out loud instead of leaving the
 * owner to infer it from an empty field, and it relabels the second leg from
 * *Povratak* to *Odakle* — because on a one-way that column is where they set
 * out from, which is the same thing it means on a round trip, where home is
 * both.
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowUpDownIcon } from "lucide-react";
import { Izbor } from "@/components/izbor";
import {
  KaskadaDestinacija,
  type Odabir,
} from "@/components/kaskada-destinacija";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sacuvajRezervaciju } from "@/app/actions/rezervacije";
import { SAMO_ADMINI } from "@/domen/pristup";
import type { Destinacija } from "@/domen/tipovi";
import { useNaMrezi } from "@/lib/mreza";
import { T } from "@/lib/tekst";
import type { GreskePolja, StanjeForme } from "@/lib/validacija";

export type PocetnaRezervacija = {
  ime: string;
  telefon: string;
  /** Empty on every booking entered before 07.09.2026 — see the field below. */
  adresa: string;
  destinacijaId: string | null;
  datumPolaska: string;
  destinacijaPovratkaId: string | null;
  datumPovratka: string;
  brojPutnika: string;
  /** Whole euros, as typed. Empty on bookings that predate the column. */
  cena: string;
  napomena: string;
};

export function FormaRezervacije({
  id,
  katalog,
  pocetna,
  nazad,
  timovi,
  timPocetni = null,
  jednosmernoPocetno = false,
}: {
  /** `null` for a new booking, the reservation id when editing. */
  id: string | null;
  katalog: Destinacija[];
  pocetna: PocetnaRezervacija;
  nazad: string;
  /**
   * The teams an admin may file this booking under, and the one selected.
   *
   * Empty for a driver, and then no field is rendered at all — a driver can
   * only ever file under their own team, so the question has one answer and
   * asking it would be noise. The Server Action reads the field's *absence*
   * as "my own team", never as "administrators only".
   */
  timovi?: readonly { id: string; naziv: string }[];
  timPocetni?: string | null;
  /**
   * Passed in rather than inferred from an empty return date, because the
   * same empty field means two different things depending on the screen.
   *
   * On **Nova** it is always empty and means nothing yet — SPEC §4 has the
   * return date "filled in later when confirmed", so a new booking must not
   * open as a one-way. On **Izmeni** an absent return date is the only record
   * of one there is, so the box opens ticked; unticking it brings the date
   * field back in one tap.
   */
  jednosmernoPocetno?: boolean;
}) {
  const [stanje, action, uToku] = useActionState<StanjeForme, FormData>(
    sacuvajRezervaciju.bind(null, id),
    undefined,
  );

  /*
   * Saving needs the network and there is no queue behind it — deliberately,
   * SPEC and the service worker both: a booking that replays hours later is a
   * duplicate the owner never finds out about. So the button says so *before*
   * the tap rather than failing after it. This is the explanation, not the
   * guard; the guard is the Server Action, which simply cannot reach the
   * server and fails.
   */
  const naMrezi = useNaMrezi();

  const [ime, postaviIme] = useState(pocetna.ime);
  const [telefon, postaviTelefon] = useState(pocetna.telefon);
  const [adresa, postaviAdresa] = useState(pocetna.adresa);
  const [brojPutnika, postaviBrojPutnika] = useState(pocetna.brojPutnika);
  const [cena, postaviCena] = useState(pocetna.cena);
  const [napomena, postaviNapomena] = useState(pocetna.napomena);
  const [datumPolaska, postaviDatumPolaska] = useState(pocetna.datumPolaska);
  const [datumPovratka, postaviDatumPovratka] = useState(pocetna.datumPovratka);
  // The pages hand over plain ids; a typed place only ever comes from the
  // cascade itself, so an opening value is always the picked half.
  const [odrediste, postaviOdrediste] = useState<Odabir>(() => ({
    id: pocetna.destinacijaId,
    novo: null,
  }));
  const [povratak, postaviPovratak] = useState<Odabir>(() => ({
    id: pocetna.destinacijaPovratkaId,
    novo: null,
  }));
  // `SAMO_ADMINI` rather than "" so the sentinel survives a round trip: an
  // empty string means "field not rendered" to the Server Action.
  const [tim, postaviTim] = useState(timPocetni ?? SAMO_ADMINI);
  const [jednosmerno, postaviJednosmerno] = useState(jednosmernoPocetno);

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

  /** Ticking it clears the return date — an empty field is what it means. */
  function prebaciJednosmerno(uklj: boolean) {
    postaviJednosmerno(uklj);
    if (uklj) postaviDatumPovratka("");
  }

  const odredisteBlok = (
    <Odeljak
      key="odrediste"
      naslov={jednosmerno ? T.forma.kuda : T.forma.odlazak}
    >
      <KaskadaDestinacija
        idPolja="odlazak"
        naziv="destinacija"
        katalog={katalog}
        vrednost={odrediste}
        onChange={postaviOdrediste}
        greska={greske.destinacija}
        disabled={uToku}
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
  );

  const poreklo = (
    <Odeljak key="poreklo" naslov={jednosmerno ? T.forma.odakle : T.forma.povratak}>
      <KaskadaDestinacija
        idPolja="povratak"
        naziv="destinacijaPovratka"
        katalog={katalog}
        vrednost={povratak}
        onChange={postaviPovratak}
        greska={greske.destinacijaPovratka}
        disabled={uToku}
        /* Država → Grad only. The owner asked for the region to go on this
           leg (06.09.2026): the return end is Beograd on nearly every
           booking, so naming its region is a tap that buys nothing. */
        bezRegije
      />
      {/* No return date on a one-way — that absence is what makes it one. */}
      {jednosmerno ? null : (
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
      )}
    </Odeljak>
  );

  const zamenaDugme = (
    <div key="zamena" className="flex justify-center">
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
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      noValidate
      /*
        React resets the form once the action resolves, and this action resolves
        WITHOUT navigating whenever validation fails. A DOM reset restores every
        `<select>` to its first option — `Izaberi…` — while React's own state
        still holds Grčka. The two then disagree: the screen shows an empty
        cascade over hidden inputs that would still save Grčka.

        Controlled `<input>`s survive it (React re-applies their value), which
        is why this only ever showed up on the dropdowns, and only on the paths
        where React had no reason to re-render them with a changed value.

        Every field in this form is controlled, so a reset can only destroy
        information here. Cancel it.
      */
      onReset={(e) => e.preventDefault()}
    >
      <input type="hidden" name="nazad" value={nazad} />

      {timovi && timovi.length > 0 ? (
        <Polje id="tim" oznaka={T.timovi.zaKoga}>
          <Izbor
            id="tim"
            name="tim"
            value={tim}
            onChange={(e) => postaviTim(e.target.value)}
            disabled={uToku}
          >
            {timovi.map((t) => (
              <option key={t.id} value={t.id}>
                {t.naziv}
              </option>
            ))}
            <option value={SAMO_ADMINI}>{T.timovi.samoAdmini}</option>
          </Izbor>
          {/*
            The one thing standing between "administrators only" and a real
            trip that no driver can see. It is a permanent block rather than a
            toast because the person choosing it is a dispatcher at 22:00 who
            will not read anything that fades.
          */}
          {tim === SAMO_ADMINI ? (
            <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {T.timovi.samoAdminiUpozorenje}
            </p>
          ) : null}
        </Polje>
      ) : null}

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

      {/*
        The doorstep, between the phone and the head count because that is the
        order the call goes in: who, on what number, from which address, how
        many of them (SPEC §4, amended 07.09.2026).
      */}
      <Polje
        id="adresa"
        oznaka={T.forma.adresa}
        pomoc={T.forma.adresaPomoc}
        greska={greske.adresa}
      >
        <Input
          id="adresa"
          name="adresa"
          value={adresa}
          onChange={(e) => postaviAdresa(e.target.value)}
          placeholder={T.forma.adresaPlaceholder}
          autoComplete="street-address"
          enterKeyHint="next"
          disabled={uToku}
          aria-invalid={greske.adresa ? true : undefined}
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

      {/* One-way is a reading of the two columns, not a tenth one. */}
      <div className="flex items-start gap-3 rounded-xl border border-border p-4">
        <Checkbox
          id="jednosmerno"
          checked={jednosmerno}
          onCheckedChange={(v) => prebaciJednosmerno(v === true)}
          disabled={uToku}
          className="mt-1 size-5"
        />
        <label
          htmlFor="jednosmerno"
          className="flex min-h-11 flex-col justify-center"
        >
          <span className="text-base font-medium">{T.forma.jednosmerno}</span>
          <span className="text-sm text-muted-foreground">
            {T.forma.jednosmernoPomoc}
          </span>
        </label>
      </div>

      {/*
        On a round trip the legs read outbound-then-return, which is the order
        they happen in. On a one-way there is no return, so the same two
        cascades read origin-then-destination — and origin comes first, because
        that is the order someone says it out loud: "from Solun to Beograd".
        Keys, so React moves these rather than re-labelling them in place.
      */}
      {jednosmerno ? (
        <>
          {poreklo}
          {zamenaDugme}
          {odredisteBlok}
        </>
      ) : (
        <>
          {odredisteBlok}
          {zamenaDugme}
          {poreklo}
        </>
      )}


      {/*
        Price and note come after the legs, because both are things you can
        only say once the trip itself is settled. The note is last of all: it
        is the only field with no shape, and it is read on Detalji rather than
        in any list.
      */}
      <Polje
        id="cena"
        oznaka={T.forma.cena}
        pomoc={T.forma.cenaPomoc}
        greska={greske.cena}
      >
        <Input
          id="cena"
          name="cena"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={cena}
          onChange={(e) => postaviCena(e.target.value)}
          disabled={uToku}
          aria-invalid={greske.cena ? true : undefined}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje
        id="napomena"
        oznaka={T.forma.napomena}
        pomoc={T.forma.napomenaPomoc}
        greska={greske.napomena}
      >
        <Textarea
          id="napomena"
          name="napomena"
          rows={3}
          value={napomena}
          onChange={(e) => postaviNapomena(e.target.value)}
          placeholder={T.forma.napomenaPlaceholder}
          disabled={uToku}
          aria-invalid={greske.napomena ? true : undefined}
          className="text-base md:text-base"
        />
      </Polje>

      {stanje && !stanje.ok && stanje.opsta ? (
        <p role="alert" className="text-sm text-destructive">
          {stanje.opsta}
        </p>
      ) : null}

      {naMrezi ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {T.mreza.offlineCuvanje}
        </p>
      )}

      {/* Primary action in the bottom third, clear of the home indicator. */}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button asChild variant="outline" className="h-12 flex-1 text-base">
          <Link href={nazad}>{T.forma.odustani}</Link>
        </Button>
        <Button
          type="submit"
          disabled={uToku || !naMrezi}
          className="h-12 flex-1 text-base"
        >
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
