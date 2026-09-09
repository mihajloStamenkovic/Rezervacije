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
import { ArrowUpDownIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Izbor } from "@/components/izbor";
import type { Odabir } from "@/components/kaskada-destinacija";
import { RedDestinacije } from "@/components/red-destinacije";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sacuvajRezervaciju } from "@/app/actions/rezervacije";
import { SAMO_ADMINI } from "@/domen/pristup";
import type { Destinacija } from "@/domen/tipovi";
import { useNaMrezi } from "@/lib/mreza";
import { T } from "@/lib/tekst";
import { cn } from "@/lib/utils";
import {
  MAX_PUTNIKA,
  pomeriPutnike,
  type GreskePolja,
  type StanjeForme,
} from "@/lib/validacija";

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
    <RedDestinacije
      key="odrediste"
      idPolja="odlazak"
      naziv="destinacija"
      oznaka={jednosmerno ? T.forma.kuda : T.forma.odlazak}
      smer="odlazak"
      katalog={katalog}
      vrednost={odrediste}
      onChange={postaviOdrediste}
      greska={greske.destinacija}
      disabled={uToku}
      onChangeDatuma={postaviDatumPolaska}
      imeDatuma="datumPolaska"
      datum={{
        vrednost: datumPolaska,
        oznaka: T.forma.datumPolaska,
        greska: greske.datumPolaska,
      }}
    />
  );

  const poreklo = (
    <RedDestinacije
      key="poreklo"
      idPolja="povratak"
      naziv="destinacijaPovratka"
      oznaka={jednosmerno ? T.forma.odakle : T.forma.povratak}
      smer="povratak"
      katalog={katalog}
      vrednost={povratak}
      onChange={postaviPovratak}
      greska={greske.destinacijaPovratka}
      disabled={uToku}
      /* Država → Grad only. The owner asked for the region to go on this leg
         (06.09.2026): the return end is Beograd on nearly every booking, so
         naming its region is a tap that buys nothing. */
      bezRegije
      onChangeDatuma={postaviDatumPovratka}
      imeDatuma="datumPovratka"
      /* No return date on a one-way — that absence is what makes it one. */
      datum={
        jednosmerno
          ? null
          : {
              vrednost: datumPovratka,
              oznaka: T.forma.datumPovratka,
              greska: greske.datumPovratka,
              // A departure is the earliest a return can be; the same rule is
              // enforced again in the schema and by a check constraint.
              min: datumPolaska || undefined,
            }
      }
    />
  );

  /*
   * The swap sits on the hairline between the two legs, half over each, which
   * is what the canvas draws and what says what it does without a label: it
   * exchanges the two rows it is straddling.
   */
  const zamenaDugme = (
    <div key="zamena" className="relative mx-4 h-px bg-border">
      <Button
        type="button"
        variant="outline"
        onClick={zameni}
        disabled={uToku}
        aria-label={T.forma.zameni}
        className="absolute -top-[18px] right-0 size-9 rounded-full bg-background p-0 text-akcenat"
      >
        <ArrowUpDownIcon className="size-4" />
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

      {/*
        The route, as one block — the canvas puts it first, and it is right to:
        it is the thing the booking is about, and everything below it is detail.

        On a round trip the legs read outbound-then-return, which is the order
        they happen in. On a one-way there is no return, so the same two rows
        read origin-then-destination — and origin comes first, because that is
        the order someone says it out loud: "from Solun to Beograd". Keys, so
        React moves these rather than re-labelling them in place.
      */}
      <div className="overflow-hidden rounded-2xl border border-border">
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

        {/* One-way is a reading of the two columns, not a tenth one. */}
        <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-4 py-3">
          <Prekidac
            ukljucen={jednosmerno}
            onChange={prebaciJednosmerno}
            disabled={uToku}
            oznaka={T.forma.jednosmerno}
            opisId="jednosmerno-opis"
          />
          <div className="min-w-0">
            <span className="block text-base font-medium">
              {T.forma.jednosmerno}
            </span>
            <span
              id="jednosmerno-opis"
              className="block text-sm text-muted-foreground"
            >
              {T.forma.jednosmernoPomoc}
            </span>
          </div>
        </div>
      </div>


      {/*
        Who, on what number, from which address — one card, because that is
        one answer to one question and not three unrelated fields. It is also
        the order the call goes in (SPEC §4, amended 07.09.2026).
      */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <RedForme id="ime" oznaka={T.forma.ime} greska={greske.ime}>
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
            className={POLJE}
          />
        </RedForme>

        <RedForme
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
            // A phone number is read back digit by digit off this screen, and
            // proportional figures make that harder than it needs to be.
            className={cn(POLJE, "font-mono")}
          />
        </RedForme>

        <RedForme
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
            className={POLJE}
          />
        </RedForme>
      </div>

      {/*
        Head count and price, side by side: two short numbers that would each
        waste a full row of a phone screen on their own.
      */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border px-3 py-2.5">
          <span className={OZNAKA}>{T.forma.brojPutnika}</span>
          <BrojPutnika
            vrednost={brojPutnika}
            onChange={postaviBrojPutnika}
            // The functional form, so two quick taps are two steps — see the
            // note on `onKorak`.
            onKorak={(za) => postaviBrojPutnika((p) => pomeriPutnike(p, za))}
            disabled={uToku}
            neispravno={greske.brojPutnika !== undefined}
          />
          {greske.brojPutnika ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {greske.brojPutnika}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border px-3 py-2.5">
          <span className={OZNAKA}>{T.forma.cena}</span>
          <div className="mt-1 flex items-baseline gap-1">
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
              className={cn(POLJE, "font-mono text-[20px] md:text-[20px]")}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              €
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {T.forma.cenaPomoc}
          </p>
          {greske.cena ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {greske.cena}
            </p>
          ) : null}
        </div>
      </div>

      {/*
        Price and note come after the legs, because both are things you can
        only say once the trip itself is settled. The note is last of all: it
        is the only field with no shape, and it is read on Detalji rather than
        in any list.
      */}
      {/*
        Last of all: the only field with no shape, and the only one read on
        Detalji rather than in any list.
      */}
      <div className="rounded-2xl border border-border px-4 py-2.5">
        <label htmlFor="napomena" className={OZNAKA}>
          {T.forma.napomena}
        </label>
        <Textarea
          id="napomena"
          name="napomena"
          rows={3}
          value={napomena}
          onChange={(e) => postaviNapomena(e.target.value)}
          placeholder={T.forma.napomenaPlaceholder}
          disabled={uToku}
          aria-invalid={greske.napomena ? true : undefined}
          className={cn(POLJE, "min-h-0 py-1")}
        />
        <p className="text-sm text-muted-foreground">
          {T.forma.napomenaPomoc}
        </p>
        {greske.napomena ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {greske.napomena}
          </p>
        ) : null}
      </div>

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
          className="h-12 flex-1 bg-akcenat text-base text-na-akcentu hover:bg-akcenat/90"
        >
          {uToku ? T.forma.cuvanje : T.forma.sacuvaj}
        </Button>
      </div>
    </form>
  );
}

/**
 * The micro-label above every field — mono, uppercase, tracked out.
 *
 * It reads as a caption rather than as a heading, which is the point: on a
 * card of stacked rows the *value* is what you scan for, and a label that
 * competes with it makes the form twice as long to read.
 */
const OZNAKA =
  "font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase";

/**
 * A field inside a card: no border of its own, since the card draws it.
 *
 * The focus ring is kept — a borderless input with no focus state is a field
 * you cannot tell you are in, and on a form this long that matters more than
 * the tidiness of losing it.
 */
const POLJE =
  "h-auto rounded-none border-0 bg-transparent px-0 py-1 text-[17px] shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:underline focus-visible:decoration-akcenat focus-visible:decoration-2 focus-visible:underline-offset-4 md:text-[17px] dark:bg-transparent";

/** One labelled row of a card, with its help text and error underneath. */
function RedForme({
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
    <div className="border-b border-border px-4 py-2.5 last:border-0">
      <label htmlFor={id} className={OZNAKA}>
        {oznaka}
      </label>
      {children}
      {pomoc ? <p className="text-sm text-muted-foreground">{pomoc}</p> : null}
      {greska ? (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {greska}
        </p>
      ) : null}
    </div>
  );
}

/*
 * `DatumEtape` stood here — the leg date as a field on the form. It moved
 * into the destination sheet on 09.09.2026 at the owner's request: the date is
 * settled in the same breath as the place, so it is asked in the same place.
 */

/**
 * The *Jednosmerna vožnja* switch.
 *
 * A `role="switch"` button rather than a Radix Switch: SPEC §9 caps this
 * project at six shadcn primitives, and a control this simple is not worth
 * making it seven. It carries no `name` — the one-way state is client-side
 * only, since what actually records it is the empty return date.
 */
function Prekidac({
  ukljucen,
  onChange,
  disabled,
  oznaka,
  opisId,
}: {
  ukljucen: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  oznaka: string;
  opisId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ukljucen}
      aria-label={oznaka}
      aria-describedby={opisId}
      disabled={disabled}
      onClick={() => onChange(!ukljucen)}
      className={cn(
        "relative flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
        ukljucen ? "bg-akcenat" : "bg-input",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-6 rounded-full bg-background shadow-sm transition-transform",
          ukljucen && "translate-x-5",
        )}
      />
    </button>
  );
}

/**
 * Head count: a stepper, with the number still typeable.
 *
 * The canvas draws − and +, which is right for a field that is 2 or 4 nearly
 * every time. It is not right for a bus of 21, so the number in the middle
 * stays a real input — the buttons are the fast path, not the only one.
 * `MAX_PUTNIKA` is 100 in the schema; the + stops there rather than handing
 * the server a value it will refuse.
 */
function BrojPutnika({
  vrednost,
  onChange,
  onKorak,
  disabled,
  neispravno,
}: {
  vrednost: string;
  onChange: (v: string) => void;
  /**
   * A *step*, not a value — and deliberately separate from `onChange`.
   *
   * The parent applies it with the functional form of `setState`, so two taps
   * inside one frame are two steps. Computing the next value here from the
   * prop looked right and was not: a quick double tap read the same stale
   * number twice and moved by one. Caught in the browser, 09.09.2026.
   */
  onKorak: (za: number) => void;
  disabled?: boolean;
  neispravno?: boolean;
}) {
  const broj = Number.parseInt(vrednost, 10);

  return (
    <div className="mt-1 flex items-center justify-between gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={() => onKorak(-1)}
        disabled={disabled || broj <= 1}
        aria-label={T.forma.manjePutnika}
        className="size-11 shrink-0 rounded-xl p-0"
      >
        <MinusIcon className="size-4" />
      </Button>
      <Input
        id="brojPutnika"
        name="brojPutnika"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={vrednost}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={neispravno ? true : undefined}
        aria-label={T.forma.brojPutnika}
        className={cn(
          POLJE,
          "text-center font-mono text-[22px] md:text-[22px]",
          // The spinners duplicate the two buttons either side of them.
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
        )}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => onKorak(1)}
        disabled={disabled || broj >= MAX_PUTNIKA}
        aria-label={T.forma.visePutnika}
        className="size-11 shrink-0 rounded-xl border-akcenat bg-akcenat-blago p-0 text-akcenat-slova"
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}

/*
 * `Odeljak` — a bordered fieldset with a legend — stood here until 09.09.2026.
 * It wrapped each leg's cascade; the legs are now rows of one route block and
 * nothing else on this screen groups that way.
 */

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
