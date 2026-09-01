"use client";

/**
 * Registers `/sw.js`.
 *
 * `SerwistProvider` is used for one feature beyond `register()`:
 * `cacheOnNavigation`. Almost every move in this app is a client-side
 * navigation, which fetches an RSC payload and never the HTML — so without
 * this, the list would be in the cache as a tree fragment and *not* as a page
 * the browser could load cold. The provider patches `history.pushState` and
 * asks the worker to fetch and cache the new pathname as a document. That is
 * what makes reloading the app in a dead spot show the schedule.
 *
 * `reloadOnOnline` is off, and that is not a detail. It defaults to `true`,
 * meaning `location.reload()` the moment the signal comes back — which, for
 * a man half way through typing a booking he has just been given over the
 * phone, would throw the form away at the worst possible moment.
 *
 * Disabled outside production: the worker is built by `npm run build:sw`,
 * which only runs after `next build`, so in `next dev` there is nothing at
 * `/sw.js` to register.
 */
import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/next/react";

export function RegistracijaSw({ children }: { children?: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
