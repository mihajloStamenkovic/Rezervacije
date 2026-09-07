"use client";

/**
 * Pozovi i Viber — SPEC §6, screen 4.
 *
 * These were a pair of plain links until 07.09.2026, when the owner reported
 * that Viber did nothing when tapped. The link itself turned out to be
 * correct: pasted into Safari's address bar,
 * `viber://chat?number=%2B381…` opens the chat, and so do all four other
 * spellings of the same number. What differs is the *navigation*. The app is
 * installed to the home screen and `src/app/manifest.ts` declares
 * `display: "standalone"`, and iOS in that mode — with no address bar to fall
 * back to — silently drops a custom-scheme navigation that comes from an
 * anchor. `tel:` is exempt, which is exactly why *Pozovi* kept working while
 * *Viber* looked dead.
 *
 * So Viber is opened by assigning `location.href` inside a click handler
 * instead. That is the same navigation the browser would have done, minus the
 * anchor iOS refuses to follow.
 *
 * If even that does nothing, the button says so rather than staying silent —
 * the previous behaviour cost the owner a day of guessing. The number goes to
 * the clipboard so the call can still be made by hand, and *Pozovi* is
 * always there as the route that never depended on another app being
 * installed.
 */
import { useState } from "react";
import { MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/tekst";

/** Long enough for the hand-off to happen, short enough not to look stuck. */
const CEKANJE_MS = 1500;

export function DugmadKontakta({
  tel,
  viber,
  broj,
}: {
  /** `tel:+381…` */
  tel: string;
  /** `viber://chat?number=%2B381…` */
  viber: string;
  /** The number itself, formatted for reading — what lands on the clipboard. */
  broj: string;
}) {
  const [nijeOtvorio, postaviNijeOtvorio] = useState(false);
  const [kopiran, postaviKopiran] = useState(false);

  function otvoriViber() {
    postaviNijeOtvorio(false);
    window.location.href = viber;

    /*
     * A successful hand-off backgrounds the page, so `visible` after the wait
     * means nothing opened. It cannot distinguish "iOS refused" from "Viber
     * opened and came straight back", but both leave the owner needing the
     * number, which is what the fallback offers.
     */
    window.setTimeout(() => {
      if (document.visibilityState === "visible") postaviNijeOtvorio(true);
    }, CEKANJE_MS);
  }

  async function kopirajBroj() {
    try {
      await navigator.clipboard.writeText(broj);
      postaviKopiran(true);
      window.setTimeout(() => postaviKopiran(false), 1500);
    } catch {
      // A refused clipboard is not worth an error: the number is on screen
      // just below, in the detail rows.
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex gap-3">
        <Button asChild className="h-12 flex-1 gap-2 text-base">
          <a href={tel}>
            <PhoneIcon className="size-4" />
            {T.detalji.pozovi}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 gap-2 text-base"
          onClick={otvoriViber}
        >
          <MessageCircleIcon className="size-4" />
          {T.detalji.viber}
        </Button>
      </div>

      {nijeOtvorio && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {T.detalji.viberNijeOtvoren}
          </span>
          <button
            type="button"
            onClick={kopirajBroj}
            className="font-medium underline underline-offset-4"
          >
            {kopiran ? T.detalji.brojKopiran : T.detalji.kopirajBroj}
          </button>
        </div>
      )}
    </div>
  );
}
