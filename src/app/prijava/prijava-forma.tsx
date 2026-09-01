"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { T } from "@/lib/tekst";
import { prijaviSe, type PrijavaStanje } from "./actions";

const POCETNO_STANJE: PrijavaStanje = undefined;

export function PrijavaForma() {
  const [stanje, action, uToku] = useActionState(prijaviSe, POCETNO_STANJE);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {T.prijava.email}
        </label>
        {/* autocomplete/inputMode matter on a phone keyboard and for
            password managers — see the agent brief. */}
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          disabled={uToku}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lozinka" className="text-sm font-medium">
          {T.prijava.lozinka}
        </label>
        <Input
          id="lozinka"
          name="lozinka"
          type="password"
          autoComplete="current-password"
          required
          disabled={uToku}
        />
      </div>

      {stanje?.greska ? (
        <p role="alert" className="text-sm text-destructive">
          {stanje.greska}
        </p>
      ) : null}

      <Button type="submit" disabled={uToku} className="mt-2 h-11 text-base">
        {uToku ? T.prijava.uToku : T.prijava.dugme}
      </Button>
    </form>
  );
}
