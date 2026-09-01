/**
 * Both ends of a leg.
 *
 * The point of these is the asymmetry: the same booking must read
 * `Beograd → Hanioti` on the way out and `Hanioti → Beograd` on the way home,
 * from the same two columns and nothing else.
 */
import { describe, expect, it } from "vitest";
import { jeIstaTacka, jeJednosmerna, rutaEtape } from "./glavna-etapa";
import {
  BEOGRAD,
  HANIOTI,
  LJUBLJANA,
  R1,
  R5,
  R7,
  SOLUN,
  dan,
  red,
} from "./fiksture";

describe("rutaEtape", () => {
  it("an outbound leg runs home → trip destination", () => {
    // R1 is the SPEC §1 worked example: Hanioti out, Beograd back.
    const ruta = rutaEtape(R1, "odlazak");
    expect(ruta.od.grad).toBe(BEOGRAD.grad);
    expect(ruta.do.grad).toBe(HANIOTI.grad);
  });

  it("a return leg runs trip destination → home, the same two columns reversed", () => {
    const ruta = rutaEtape(R1, "povratak");
    expect(ruta.od.grad).toBe(HANIOTI.grad);
    expect(ruta.do.grad).toBe(BEOGRAD.grad);
  });

  it("the two directions are exact mirrors of each other", () => {
    const napolje = rutaEtape(R1, "odlazak");
    const nazad = rutaEtape(R1, "povratak");
    expect(napolje.od.id).toBe(nazad.do.id);
    expect(napolje.do.id).toBe(nazad.od.id);
  });

  it("answers the question the card is actually asking on a return", () => {
    // "↓ Povratak · Beograd" alone does not say where from. This does.
    const stigli = red({
      n: 31,
      ime: "Jelena Ilić",
      telefon: "+381641112233",
      destinacija: SOLUN,
      datumPolaska: dan(-4),
      destinacijaPovratka: BEOGRAD,
      datumPovratka: dan(3),
      brojPutnika: 2,
    });
    expect(rutaEtape(stigli, "povratak").od.grad).toBe(SOLUN.grad);
    expect(rutaEtape(stigli, "povratak").do.grad).toBe(BEOGRAD.grad);
  });

  it("resolves an inactive destination like any other — it is still a place", () => {
    // R7 points at Ljubljana, which Slovenija being unavailable does not erase.
    const ruta = rutaEtape(R7, "odlazak");
    expect(ruta.od.grad).toBe(BEOGRAD.grad);
    expect(ruta.do.grad).toBe(LJUBLJANA.grad);
  });
});

describe("jeIstaTacka", () => {
  /**
   * The honest limit of the inference.
   *
   * R5 is the one-way ride *home*: SPEC §5 says it is entered with Beograd in
   * the outbound column, and the return column defaults to Beograd too. Both
   * ends are then the same row, and no amount of reading the schema recovers
   * the Greek town they actually set out from — it was never stored. The card
   * collapses to one name rather than drawing an arrow from Beograd to
   * Beograd, which is the truthful rendering of what is known.
   */
  it("is true for the one-way ride home, where no origin was ever stored", () => {
    expect(jeIstaTacka(rutaEtape(R5, "odlazak"))).toBe(true);
  });

  it("is false for an ordinary trip, in both directions", () => {
    expect(jeIstaTacka(rutaEtape(R1, "odlazak"))).toBe(false);
    expect(jeIstaTacka(rutaEtape(R1, "povratak"))).toBe(false);
  });

  it("compares identity, not display name", () => {
    expect(jeIstaTacka(rutaEtape(R7, "odlazak"))).toBe(false);
  });
});

describe("jeJednosmerna", () => {
  it("is true when no return date was ever filled in", () => {
    // R5 — the one-way ride home.
    expect(jeJednosmerna(R5)).toBe(true);
  });

  it("is false for a booking with a return date, past or future", () => {
    expect(jeJednosmerna(R1)).toBe(false);
    expect(jeJednosmerna(R7)).toBe(false);
  });

  it("is about the date, not the two destinations", () => {
    // Same place at both ends, but a return date — a there-and-back on the
    // same route is not a one-way.
    const tamoNazad = red({
      n: 32,
      ime: "Test",
      telefon: "+381641112233",
      destinacija: HANIOTI,
      datumPolaska: dan(1),
      destinacijaPovratka: HANIOTI,
      datumPovratka: dan(2),
      brojPutnika: 1,
    });
    expect(jeJednosmerna(tamoNazad)).toBe(false);
  });
});
