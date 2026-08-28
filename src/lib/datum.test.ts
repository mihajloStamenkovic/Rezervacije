import { describe, expect, it } from "vitest";
import {
  danasBeograd,
  danUNedelji,
  formatDanMesec,
  formatDatum,
  formatDug,
  imeDana,
  jeDatum,
  krajMeseca,
  krajNedelje,
  naslovDana,
  pocetakMeseca,
  pocetakNedelje,
  pomeriDane,
  razlikaUDanima,
} from "./datum";

describe("danasBeograd", () => {
  it("reads Belgrade, not the process timezone", () => {
    // 22:30 UTC on 31.12.2025 is already 23:30 on the 31st in Belgrade,
    // 11:30 on 01.01.2026 in Auckland, and 01:30 on the 1st in Athens.
    // Belgrade is the only answer the app accepts.
    const trenutak = new Date("2025-12-31T22:30:00Z");
    expect(danasBeograd(trenutak)).toBe("2025-12-31");
  });

  it("has already rolled over when Belgrade has", () => {
    // 23:30 UTC is 00:30 the next day in Belgrade (CET, +1).
    expect(danasBeograd(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });

  it("handles summer time (CEST, +2)", () => {
    expect(danasBeograd(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-15");
    expect(danasBeograd(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
  });

  it("returns YYYY-MM-DD", () => {
    expect(jeDatum(danasBeograd())).toBe(true);
  });
});

describe("jeDatum", () => {
  it.each([
    ["2026-01-01", true],
    ["2026-02-29", false], // 2026 is not a leap year
    ["2024-02-29", true],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-04-31", false],
    ["26-01-01", false],
    ["2026-1-1", false],
    ["", false],
  ])("%s → %s", (ulaz, ocekivano) => {
    expect(jeDatum(ulaz)).toBe(ocekivano);
  });
});

describe("pomeriDane", () => {
  it("crosses a month boundary", () => {
    expect(pomeriDane("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("crosses a year boundary backwards", () => {
    expect(pomeriDane("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("crosses the DST spring-forward night without losing a day", () => {
    // Europe/Belgrade springs forward on 29.03.2026. A `Date`-based
    // implementation in a local timezone can produce 28.03 twice here.
    expect(pomeriDane("2026-03-28", 1)).toBe("2026-03-29");
    expect(pomeriDane("2026-03-29", 1)).toBe("2026-03-30");
  });
  it("handles a leap day", () => {
    expect(pomeriDane("2024-02-28", 1)).toBe("2024-02-29");
    expect(pomeriDane("2024-02-29", 1)).toBe("2024-03-01");
  });
});

describe("razlikaUDanima", () => {
  it("counts forwards and backwards", () => {
    expect(razlikaUDanima("2026-01-01", "2026-01-15")).toBe(14);
    expect(razlikaUDanima("2026-01-15", "2026-01-01")).toBe(-14);
    expect(razlikaUDanima("2026-01-01", "2026-01-01")).toBe(0);
  });
  it("is exact across the DST change", () => {
    expect(razlikaUDanima("2026-03-28", "2026-03-30")).toBe(2);
    expect(razlikaUDanima("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("weeks and months", () => {
  it("treats Monday as the first day", () => {
    // 2026-08-28 is a Friday.
    expect(danUNedelji("2026-08-28")).toBe(4);
    expect(pocetakNedelje("2026-08-28")).toBe("2026-08-24");
    expect(krajNedelje("2026-08-28")).toBe("2026-08-30");
  });
  it("keeps a Sunday in the week that just ended", () => {
    expect(pocetakNedelje("2026-08-30")).toBe("2026-08-24");
  });
  it("bounds a month", () => {
    expect(pocetakMeseca("2026-02-14")).toBe("2026-02-01");
    expect(krajMeseca("2026-02-14")).toBe("2026-02-28");
    expect(krajMeseca("2024-02-14")).toBe("2024-02-29");
    expect(krajMeseca("2026-08-01")).toBe("2026-08-31");
  });
});

describe("formatting", () => {
  it("formats Serbian dates", () => {
    expect(formatDatum("2026-01-01")).toBe("01.01.2026.");
    expect(formatDanMesec("2026-09-12")).toBe("12.09.");
    expect(formatDug("2026-01-01")).toBe("1. januar 2026.");
    expect(imeDana("2026-09-12")).toBe("subota");
  });

  it("never shifts a date by a timezone", () => {
    // The classic bug: `new Date("2026-01-01")` is midnight UTC, which is
    // 31.12.2025 in every timezone west of Greenwich.
    expect(formatDatum("2026-01-01")).toBe("01.01.2026.");
    expect(formatDug("2026-12-31")).toBe("31. decembar 2026.");
  });
});

describe("naslovDana", () => {
  const danas = "2026-09-10"; // Thursday
  it.each([
    ["2026-09-10", "danas"],
    ["2026-09-11", "sutra"],
    ["2026-09-09", "juče"],
    ["2026-09-12", "subota, 12.09."],
    ["2027-01-04", "ponedeljak, 04.01.2027."],
  ])("%s → %s", (datum, ocekivano) => {
    expect(naslovDana(datum, danas)).toBe(ocekivano);
  });
});
