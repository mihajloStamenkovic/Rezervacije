/**
 * The direction chip — ↑ Odlazak / ↓ Povratak.
 *
 * The arrow is part of the label rather than a decorative icon: it is the
 * fastest thing to read on a card at arm's length, and a screen reader that
 * skipped it would lose the distinction entirely.
 */
import { cn } from "@/lib/utils";
import { T } from "@/lib/tekst";
import type { Smer } from "@/domen/tipovi";

const STIL: Record<Smer, string> = {
  odlazak:
    "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25",
  povratak:
    "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/25",
};

const OZNAKA: Record<Smer, string> = {
  odlazak: T.smer.odlazakSaStrelicom,
  povratak: T.smer.povratakSaStrelicom,
};

export function CipSmera({
  smer,
  className,
}: {
  smer: Smer;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STIL[smer],
        className,
      )}
    >
      {OZNAKA[smer]}
    </span>
  );
}
