/**
 * Light or dark.
 *
 * The case that matters is the last one: with nothing stored the phone still
 * decides, which is what keeps the app looking exactly as it did for everyone
 * who never opens Podešavanja.
 */
import { describe, expect, it } from "vitest";
import {
  BOJA_TRAKE,
  KLASA,
  TEME,
  jeTema,
  procitajTemu,
  temaZaPrimenu,
} from "./tema";

describe("procitajTemu", () => {
  it("reads the two it knows", () => {
    expect(procitajTemu("svetla")).toBe("svetla");
    expect(procitajTemu("tamna")).toBe("tamna");
  });

  it("reads anything else as no choice at all", () => {
    // This runs in the blocking script, before the first paint. A throw here
    // is a blank app, so every unreadable value has to mean "not chosen".
    expect(procitajTemu(null)).toBeNull();
    expect(procitajTemu(undefined)).toBeNull();
    expect(procitajTemu("")).toBeNull();
    expect(procitajTemu("dark")).toBeNull();
    expect(procitajTemu("sistemski")).toBeNull();
    expect(procitajTemu("{\"tema\":\"tamna\"}")).toBeNull();
  });
});

describe("temaZaPrimenu", () => {
  it("honours the stored choice against the phone", () => {
    expect(temaZaPrimenu("svetla", true)).toBe("svetla");
    expect(temaZaPrimenu("tamna", false)).toBe("tamna");
  });

  it("follows the phone until something is chosen", () => {
    expect(temaZaPrimenu(null, true)).toBe("tamna");
    expect(temaZaPrimenu(null, false)).toBe("svetla");
  });
});

describe("the constants the two appliers share", () => {
  it("names a class and a status bar colour for each theme", () => {
    expect(TEME).toEqual(["svetla", "tamna"]);
    for (const tema of TEME) {
      expect(jeTema(tema)).toBe(true);
      expect(KLASA[tema]).toBe(tema);
      expect(BOJA_TRAKE[tema]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the status bar matched to the two --background values", () => {
    // oklch(1 0 0) and oklch(0.145 0 0) in globals.css. If a palette moves,
    // this is the line that has to move with it.
    expect(BOJA_TRAKE.svetla).toBe("#ffffff");
    expect(BOJA_TRAKE.tamna).toBe("#242424");
  });
});
