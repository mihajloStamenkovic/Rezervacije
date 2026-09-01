import { describe, expect, it } from "vitest";
import {
  DANAS,
  HANIOTI,
  BEOGRAD,
  R1,
  R2,
  R3,
  R4,
  R5,
  R6,
  R7,
  dan,
  red,
  SOLUN,
} from "./fiksture";
import {
  bezGlavneEtape,
  etapaPovratka,
  resolveMainLeg,
  sveEtape,
} from "./glavna-etapa";

describe("resolveMainLeg — SPEC §1", () => {
  it("departure in the future → outbound leg, trip destination", () => {
    const glavna = resolveMainLeg(R1, DANAS);
    expect(glavna).toEqual({
      smer: "odlazak",
      datum: dan(14),
      destinacija: HANIOTI,
    });
  });

  it("departure exactly today → still outbound (the >= boundary, not >)", () => {
    const glavna = resolveMainLeg(R2, DANAS);
    expect(glavna?.smer).toBe("odlazak");
    expect(glavna?.datum).toBe(DANAS);
    expect(glavna?.destinacija).toBe(SOLUN);
  });

  it("flips the day AFTER departure, not on it", () => {
    // Same row, one day later: yesterday's departure is now a homecoming.
    const sutra = dan(1);
    expect(resolveMainLeg(R2, DANAS)?.smer).toBe("odlazak");
    expect(resolveMainLeg(R2, sutra)?.smer).toBe("povratak");
    expect(resolveMainLeg(R2, sutra)?.destinacija).toBe(BEOGRAD);
  });

  it("departed yesterday, return ahead → return leg, home destination", () => {
    const glavna = resolveMainLeg(R3, DANAS);
    expect(glavna).toEqual({
      smer: "povratak",
      datum: dan(9),
      destinacija: BEOGRAD,
    });
    // It has left Grčka behind — the main destination is now home.
    expect(glavna?.destinacija.drzava).toBe("Srbija");
  });

  it("departed, no return date → no main leg at all", () => {
    expect(resolveMainLeg(R4, DANAS)).toBeNull();
    expect(bezGlavneEtape(R4, DANAS)).toBe(true);
  });

  it("one-way ride home (Beograd in the outbound column) behaves like any trip", () => {
    const glavna = resolveMainLeg(R5, DANAS);
    expect(glavna).toEqual({
      smer: "odlazak",
      datum: dan(3),
      destinacija: BEOGRAD,
    });
  });

  it("same-day round trip resolves to its departure while it is ahead", () => {
    expect(resolveMainLeg(R6, DANAS)).toMatchObject({
      smer: "odlazak",
      datum: dan(2),
    });
    // On the day itself it is still a departure — the >= boundary again.
    expect(resolveMainLeg(R6, dan(2))?.smer).toBe("odlazak");
    // The day after, the return has passed too but still resolves.
    expect(resolveMainLeg(R6, dan(3))).toMatchObject({
      smer: "povratak",
      datum: dan(2),
    });
  });

  it("still resolves a booking pointing at an inactive destination", () => {
    const glavna = resolveMainLeg(R7, DANAS);
    expect(glavna?.destinacija.grad).toBe("Ljubljana");
    expect(glavna?.destinacija.aktivna).toBe(false);
  });

  it("the whole worked example from SPEC §1, both dates", () => {
    // Marko Petrović, Hanioti, polazak 01.01.2026, povratak 15.01.2026.
    const marko = red({
      n: 1,
      ime: "Marko Petrović",
      telefon: "+381641234567",
      destinacija: HANIOTI,
      datumPolaska: "2026-01-01",
      datumPovratka: "2026-01-15",
      brojPutnika: 4,
    });

    expect(resolveMainLeg(marko, "2025-12-20")).toEqual({
      smer: "odlazak",
      datum: "2026-01-01",
      destinacija: HANIOTI,
    });
    expect(resolveMainLeg(marko, "2026-01-05")).toEqual({
      smer: "povratak",
      datum: "2026-01-15",
      destinacija: BEOGRAD,
    });
  });

  it("rejects a malformed today rather than comparing strings quietly", () => {
    // "2026-1-5" >= "2026-01-15" is a perfectly quiet `true`.
    expect(() => resolveMainLeg(R1, "2026-1-5")).toThrow(/Neispravan datum/);
    expect(() => resolveMainLeg(R1, "danas")).toThrow(/Neispravan datum/);
  });
});

describe("legs", () => {
  it("every reservation has an outbound leg; the return is optional", () => {
    expect(sveEtape(R1)).toHaveLength(2);
    expect(sveEtape(R4)).toHaveLength(1);
    expect(etapaPovratka(R4)).toBeNull();
  });

  it("a same-day round trip still has two distinct legs", () => {
    const etape = sveEtape(R6);
    expect(etape.map((e) => e.smer)).toEqual(["odlazak", "povratak"]);
    expect(etape[0].datum).toBe(etape[1].datum);
  });
});
