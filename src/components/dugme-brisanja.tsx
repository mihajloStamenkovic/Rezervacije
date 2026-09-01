"use client";

/**
 * Delete, behind a confirm dialog — SPEC §8, standing rule 6.
 *
 * Deletion is permanent: there is no status column, no recycle bin and no
 * undo, and the nightly `pg_dump` is the only way back. This dialog is
 * therefore the entire guard, so it says so in words rather than asking a
 * bland "are you sure".
 *
 * The confirm button is a real form submit to a Server Action, not an
 * `onClick` handler. That keeps deletion working the same way whatever the
 * client-side state is, and keeps the destructive path off the browser's
 * `confirm()`, which blocks the page and looks like a scam popup on a phone.
 */
import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { obrisiRezervaciju } from "@/app/actions/rezervacije";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNaMrezi } from "@/lib/mreza";
import { T } from "@/lib/tekst";

export function DugmeBrisanja({
  id,
  nazad,
}: {
  id: string;
  nazad: string;
}) {
  const [otvoren, postaviOtvoren] = useState(false);

  /*
   * Same rule as the save button, and it matters more here. Deletion is
   * permanent and there is no undo; an offline tap that looks like it worked
   * and did not is the one outcome worse than an obvious failure, because the
   * owner walks away believing the booking is gone.
   */
  const naMrezi = useNaMrezi();

  return (
    <Dialog open={otvoren} onOpenChange={postaviOtvoren}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="h-12 flex-1 gap-2 text-base">
          <Trash2Icon className="size-4" />
          {T.detalji.obrisi}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{T.brisanje.naslov}</DialogTitle>
          <DialogDescription>
            {naMrezi ? T.brisanje.poruka : T.mreza.offlineBrisanje}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-3">
          <DialogClose asChild>
            <Button variant="outline" className="h-12 flex-1 text-base">
              {T.brisanje.odustani}
            </Button>
          </DialogClose>
          <form action={obrisiRezervaciju.bind(null, id)} className="flex-1">
            <input type="hidden" name="nazad" value={nazad} />
            <Button
              type="submit"
              variant="destructive"
              disabled={!naMrezi}
              className="h-12 w-full text-base"
            >
              {T.brisanje.potvrdi}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
