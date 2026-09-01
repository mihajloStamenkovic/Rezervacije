"use client";

/**
 * The offline bar.
 *
 * Sits at the very top of every screen, above the sticky headers, and pushes
 * them down rather than covering them — a bar that overlaps the search field
 * is a second problem on top of the first. It says two things, because two
 * things are true: there is no connection, and what is on screen is the last
 * thing that was fetched. The second half is the one that stops the owner
 * from trusting a stale schedule.
 *
 * Amber, not red. Nothing is broken and nothing was lost; the app is simply
 * reading from yesterday.
 */
import { WifiOffIcon } from "lucide-react";
import { useNaMrezi } from "@/lib/mreza";
import { T } from "@/lib/tekst";

export function TrakaMreze() {
  const naMrezi = useNaMrezi();

  if (naMrezi) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-amber-600/25 bg-amber-500/15 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-amber-900 dark:text-amber-200"
    >
      <WifiOffIcon aria-hidden="true" className="size-4 shrink-0" />
      <p className="text-sm leading-snug">
        <span className="font-medium">{T.mreza.offline}</span>{" "}
        <span className="opacity-80">{T.mreza.offlineOpis}</span>
      </p>
    </div>
  );
}
