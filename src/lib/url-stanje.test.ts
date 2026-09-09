/**
 * The tab in the query string — SPEC §2, amended 09.09.2026.
 *
 * Two properties, and both matter on a phone. A parameter that is missing,
 * misspelt or hand-edited has to degrade to *Odlasci* rather than throw: the
 * URL is pasted between the two accounts and can go stale, and an unfiltered
 * list is recoverable where an error page is not. And the default has to stay
 * out of the query, because this string is what the back button remembers.
 */
import { describe, expect, it } from "vitest";
import {
  PODRAZUMEVANI_TAB,
  procitajStanjeUrl,
  putanjaListe,
  upitZaStanje,
} from "./url-stanje";

describe("tab u URL-u", () => {
  it("opens on Odlasci when nothing says otherwise", () => {
    expect(procitajStanjeUrl({}).tab).toBe("odlazak");
    expect(PODRAZUMEVANI_TAB).toBe("odlazak");
  });

  it("reads the returns tab", () => {
    expect(procitajStanjeUrl({ tab: "povratak" }).tab).toBe("povratak");
  });

  it("falls back to Odlasci on anything it does not recognise", () => {
    expect(procitajStanjeUrl({ tab: "povratci" }).tab).toBe("odlazak");
    expect(procitajStanjeUrl({ tab: "" }).tab).toBe("odlazak");
    expect(procitajStanjeUrl({ tab: ["povratak", "odlazak"] }).tab).toBe(
      "povratak",
    );
  });

  it("writes the returns tab and leaves the default unwritten", () => {
    const stanje = procitajStanjeUrl({ tab: "povratak" });
    expect(upitZaStanje(stanje)).toBe("?tab=povratak");
    expect(upitZaStanje({ ...stanje, tab: "odlazak" })).toBe("");
  });

  it("survives a round trip alongside the other filters", () => {
    const putanja = putanjaListe({
      ...procitajStanjeUrl({ od: "2026-01-01", q: "marko" }),
      tab: "povratak",
    });
    expect(putanja).toBe("/?od=2026-01-01&q=marko&tab=povratak");

    const nazad = procitajStanjeUrl({
      od: "2026-01-01",
      q: "marko",
      tab: "povratak",
    });
    expect(nazad.tab).toBe("povratak");
    expect(nazad.opseg).toEqual({ od: "2026-01-01", do: "2026-01-01" });
    expect(nazad.pretraga).toBe("marko");
  });
});
