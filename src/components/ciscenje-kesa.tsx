"use client";

/**
 * Empties the service worker's data caches whenever the login screen renders.
 *
 * Without this, logging out leaves the previous session's pages sitting in
 * Cache Storage, and the next person to open the app on that phone with no
 * signal gets the last schedule handed to them by the worker before the
 * redirect to `/prijava` ever reaches the network. The session cookie is gone
 * and RLS is untouched — but the names and phone numbers are still on the
 * device, which is the part that matters.
 *
 * Reaching `/prijava` means one of exactly two things: signed out, or not
 * signed in yet. Both are the right moment to drop cached bookings, so this
 * hangs off the screen rather than off the logout button — a session that
 * expires on its own clears just as thoroughly as one that is ended on
 * purpose.
 *
 * `gradnja` and `sredstva` are deliberately left alone. They hold
 * content-hashed JavaScript and the app icons; there is nothing personal in
 * them, and clearing them would mean re-downloading the whole bundle on a
 * connection that has just proven itself unreliable.
 */
import { useEffect } from "react";
import { KESEVI_SA_PODACIMA } from "@/lib/kes";

export function CiscenjeKesa() {
  useEffect(() => {
    if (!("caches" in window)) return;
    // Fire and forget: nothing on this screen waits for it, and a browser
    // that refuses (private mode, storage pressure) has no cache to clear.
    void Promise.all(KESEVI_SA_PODACIMA.map((ime) => caches.delete(ime))).catch(
      () => {},
    );
  }, []);

  return null;
}
