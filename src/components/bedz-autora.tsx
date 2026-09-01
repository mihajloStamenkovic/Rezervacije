/**
 * Which of the two accounts entered a booking.
 *
 * The colour is `profiles.boja`, a hex string from the database, so it has to
 * be an inline style — Tailwind cannot generate a class for a value it never
 * sees at build time. Both seeded colours (`#2563eb`, `#d97706`) are dark
 * enough to carry white text.
 *
 * On a card the badge is the initial alone, which is all that fits and all
 * that is needed to tell two people apart; the name is still exposed to a
 * screen reader and to a long-press tooltip.
 */
import { cn } from "@/lib/utils";
import type { Profile } from "@/domen/tipovi";

export function BedzAutora({
  autor,
  saImenom = false,
  className,
}: {
  autor: Pick<Profile, "ime" | "boja">;
  saImenom?: boolean;
  className?: string;
}) {
  const inicijal = [...autor.ime][0]?.toUpperCase() ?? "?";

  if (saImenom) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <Tacka boja={autor.boja} inicijal={inicijal} />
        <span className="font-medium">{autor.ime}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex", className)} title={autor.ime}>
      <Tacka boja={autor.boja} inicijal={inicijal} />
      <span className="sr-only">{autor.ime}</span>
    </span>
  );
}

function Tacka({ boja, inicijal }: { boja: string; inicijal: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: boja }}
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold text-white"
    >
      {inicijal}
    </span>
  );
}
