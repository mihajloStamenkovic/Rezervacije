"use client";

/**
 * Is the browser online?
 *
 * `navigator.onLine` is the only signal here, and it is a weak one: it
 * reports the state of the network interface, not whether anything is
 * reachable, so a phone on a hotel WiFi with no upstream still says `true`.
 * It is used anyway, because the alternative in Next 16 —
 * `experimental.useOffline` — buys a better signal by also making Next queue
 * and silently retry failed Server Actions once the connection returns. That
 * is exactly the behaviour SPEC forbids: a booking that replays two hours
 * later is a duplicate nobody knows about. A weaker signal and honest
 * failures is the right side of that trade.
 *
 * So this hook is what draws the bar and disables the buttons. It is not what
 * makes an offline save safe — the Server Action failing is. The hook only
 * explains, in advance, why it is going to.
 *
 * `useSyncExternalStore` rather than an effect, so the value is read during
 * render and there is no first frame that claims to be online.
 */
import { useSyncExternalStore } from "react";

function pretplati(osvezi: () => void): () => void {
  window.addEventListener("online", osvezi);
  window.addEventListener("offline", osvezi);
  return () => {
    window.removeEventListener("online", osvezi);
    window.removeEventListener("offline", osvezi);
  };
}

function ocitaj(): boolean {
  return navigator.onLine;
}

/**
 * On the server, and for the first paint before hydration, this is `true`.
 * Optimistic on purpose: a bar that flashes "no connection" on every cold
 * start of a perfectly connected phone would teach the owner to ignore it,
 * and then it would be worth nothing on the day it is right.
 */
function ocitajNaServeru(): boolean {
  return true;
}

export function useNaMrezi(): boolean {
  return useSyncExternalStore(pretplati, ocitaj, ocitajNaServeru);
}
