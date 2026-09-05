/**
 * The proxy matcher is a single regex in a comment-heavy config block, and
 * everything it governs fails *quietly* when it drifts.
 *
 * Phase 6 already paid for this once: the matcher excluded `icons/` while the
 * directory was `ikone/`, so every icon took a redirect and the install prompt
 * never appeared — with nothing anywhere reporting an error. `/api/health` has
 * the same shape of failure and a worse consequence: a monitor that follows a
 * `307` to `/prijava` gets a perfectly rendered login page, calls it `200`, and
 * reports the app healthy while the database is unreachable.
 */
import { describe, expect, it } from "vitest";
import { config } from "./proxy";

const [obrazac] = config.matcher;
const poklapa = (putanja: string) => new RegExp(`^${obrazac}$`).test(putanja);

describe("proxy matcher — what the session refresh runs on", () => {
  it("runs on every route that reads data", () => {
    for (const putanja of [
      "/",
      "/nova",
      "/podesavanja",
      "/rezervacija/8f14e45f",
      "/rezervacija/8f14e45f/izmeni",
    ]) {
      expect(poklapa(putanja), putanja).toBe(true);
    }
  });

  it("runs on /prijava too — the page itself decides it is public", () => {
    // Excluding it here would skip the session refresh on the one route where
    // a session is created.
    expect(poklapa("/prijava")).toBe(true);
  });

  it("does NOT run on /api/health, so a monitor gets the check", () => {
    expect(poklapa("/api/health")).toBe(false);
  });

  it("does NOT run on the files that make the app installable", () => {
    for (const putanja of [
      "/manifest.webmanifest",
      "/sw.js",
      "/favicon.ico",
      "/ikone/ikona-192.png",
    ]) {
      expect(poklapa(putanja), putanja).toBe(false);
    }
  });

  it("does NOT run on Next's own build output", () => {
    expect(poklapa("/_next/static/chunks/main.js")).toBe(false);
    expect(poklapa("/_next/image")).toBe(false);
  });
});
