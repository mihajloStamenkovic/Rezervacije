"use client";

/**
 * The three interactive pieces of `/nalozi`.
 *
 * Controlled fields for the same reason as `forma-rezervacije.tsx`: the action
 * resolves without navigating when it fails, and React would otherwise hand
 * back an emptied form as the reward for a mistyped address.
 *
 * The password field is `type="password"` with `autocomplete="new-password"`,
 * has no `defaultValue`, and is never returned in the action's result. The
 * owner types it once and tells the driver in person — there is no email in
 * this flow to leak it into.
 */
import { useActionState, useState } from "react";
import { Izbor } from "@/components/izbor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  napraviNalog,
  napraviTim,
  promeniAktivnost,
  promeniTim,
  type StanjeNaloga,
} from "@/app/actions/nalozi";
import { T } from "@/lib/tekst";

/** Dark enough to carry the white initial the badge draws on them. */
const BOJE = [
  "#2563eb",
  "#d97706",
  "#059669",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
] as const;

export function FormaTima() {
  const [stanje, action, uToku] = useActionState<StanjeNaloga, FormData>(
    napraviTim,
    undefined,
  );
  const [naziv, postaviNaziv] = useState("");

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="naziv"
          value={naziv}
          onChange={(e) => postaviNaziv(e.target.value)}
          placeholder={T.timovi.naziv}
          aria-label={T.timovi.naziv}
          disabled={uToku}
          className="h-11 text-base md:text-base"
        />
        <Button type="submit" disabled={uToku} className="h-11 shrink-0">
          {T.timovi.dodaj}
        </Button>
      </div>
      <Greska stanje={stanje} />
    </form>
  );
}

export function FormaNaloga({
  timovi,
}: {
  timovi: readonly { id: string; naziv: string }[];
}) {
  const [stanje, action, uToku] = useActionState<StanjeNaloga, FormData>(
    napraviNalog,
    undefined,
  );
  const [ime, postaviIme] = useState("");
  const [email, postaviEmail] = useState("");
  const [lozinka, postaviLozinku] = useState("");
  const [boja, postaviBoju] = useState<string>(BOJE[0]);
  const [timId, postaviTim] = useState(timovi[0]?.id ?? "");

  return (
    <form action={action} className="flex flex-col gap-4">
      <Polje id="nalog-ime" oznaka={T.timovi.ime}>
        <Input
          id="nalog-ime"
          name="ime"
          value={ime}
          onChange={(e) => postaviIme(e.target.value)}
          autoComplete="off"
          disabled={uToku}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje id="nalog-email" oznaka={T.timovi.email}>
        <Input
          id="nalog-email"
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => postaviEmail(e.target.value)}
          autoComplete="off"
          disabled={uToku}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje
        id="nalog-lozinka"
        oznaka={T.timovi.lozinka}
        pomoc={T.timovi.lozinkaPomoc}
      >
        <Input
          id="nalog-lozinka"
          name="lozinka"
          type="password"
          value={lozinka}
          onChange={(e) => postaviLozinku(e.target.value)}
          autoComplete="new-password"
          disabled={uToku}
          className="h-11 text-base md:text-base"
        />
      </Polje>

      <Polje id="nalog-tim" oznaka={T.timovi.tim}>
        <Izbor
          id="nalog-tim"
          name="timId"
          value={timId}
          onChange={(e) => postaviTim(e.target.value)}
          disabled={uToku}
        >
          {timovi.map((t) => (
            <option key={t.id} value={t.id}>
              {t.naziv}
            </option>
          ))}
        </Izbor>
      </Polje>

      <Polje id="nalog-boja" oznaka={T.timovi.boja}>
        <input type="hidden" name="boja" value={boja} />
        <div className="flex gap-2">
          {BOJE.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => postaviBoju(b)}
              aria-label={b}
              aria-pressed={b === boja}
              disabled={uToku}
              style={{ backgroundColor: b }}
              className={
                "size-11 rounded-full transition-[box-shadow]" +
                (b === boja ? " ring-2 ring-foreground ring-offset-2" : "")
              }
            />
          ))}
        </div>
      </Polje>

      <Greska stanje={stanje} />

      <Button type="submit" disabled={uToku} className="h-12 text-base">
        {T.timovi.napravi}
      </Button>
    </form>
  );
}

/**
 * Move a driver to another crew.
 *
 * Their existing bookings do not move with them: a booking carries its own
 * `tim_id`, so history stays where it happened and nobody's old customers are
 * handed to a crew that never drove them. If a specific trip should follow the
 * person, an admin reassigns that booking on its own edit screen.
 *
 * Submits on change rather than behind a save button — there is one field and
 * a button beside it would only be a second tap.
 */
export function IzborTima({
  id,
  timId,
  timovi,
}: {
  id: string;
  timId: string | null;
  timovi: readonly { id: string; naziv: string }[];
}) {
  return (
    <form action={promeniTim.bind(null, id)}>
      <Izbor
        name="timId"
        defaultValue={timId ?? ""}
        aria-label={T.timovi.tim}
        className="h-9 w-auto text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {timovi.map((t) => (
          <option key={t.id} value={t.id}>
            {t.naziv}
          </option>
        ))}
      </Izbor>
    </form>
  );
}

/**
 * Access on or off. A plain form button rather than a switch — the project has
 * five shadcn primitives and a Switch is not one of them, and a control that
 * posts is honest about the fact that this takes a round trip.
 */
export function PrekidacPristupa({
  id,
  aktivan,
  sam,
}: {
  id: string;
  aktivan: boolean;
  /** An admin must not be able to lock themselves out. */
  sam: boolean;
}) {
  if (sam) return null;
  return (
    <form action={promeniAktivnost.bind(null, id, !aktivan)}>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        {aktivan ? T.timovi.zakljucaj : T.timovi.otkljucaj}
      </Button>
    </form>
  );
}

function Greska({ stanje }: { stanje: StanjeNaloga }) {
  if (!stanje || stanje.ok) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {stanje.greska}
    </p>
  );
}

function Polje({
  id,
  oznaka,
  pomoc,
  children,
}: {
  id: string;
  oznaka: string;
  pomoc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {oznaka}
      </label>
      {children}
      {pomoc ? <p className="text-sm text-muted-foreground">{pomoc}</p> : null}
    </div>
  );
}
