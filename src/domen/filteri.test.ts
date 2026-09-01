import { describe, expect, it } from "vitest";
import {
  brojAktivnihFiltera,
  normalizujOpseg,
  opsegZaCip,
  opsegZaDan,
  rezimPrikaza,
  uOpsegu,
} from "./filteri";

// 15.01.2026 is a Thursday, so the week and the month both have real edges.
const DANAS = "2026-01-15";

describe("date chips — SPEC §3", () => {
  it("danas is a one-day range", () => {
    expect(opsegZaCip("danas", DANAS)).toEqual({ od: DANAS, do: DANAS });
  });

  it("ova nedelja is Monday to Sunday around today", () => {
    expect(opsegZaCip("ovaNedelja", DANAS)).toEqual({
      od: "2026-01-12",
      do: "2026-01-18",
    });
  });

  it("ovaj mesec is the whole calendar month", () => {
    expect(opsegZaCip("ovajMesec", DANAS)).toEqual({
      od: "2026-01-01",
      do: "2026-01-31",
    });
  });

  it("a week that crosses a month or a year boundary still spans seven days", () => {
    expect(opsegZaCip("ovaNedelja", "2026-01-01")).toEqual({
      od: "2025-12-29",
      do: "2026-01-04",
    });
  });

  it("February in a non-leap year ends on the 28th", () => {
    expect(opsegZaCip("ovajMesec", "2026-02-10").do).toBe("2026-02-28");
    expect(opsegZaCip("ovajMesec", "2024-02-10").do).toBe("2024-02-29");
  });

  it("refuses a malformed today", () => {
    expect(() => opsegZaCip("danas", "15.01.2026")).toThrow(/Neispravan datum/);
  });
});

describe("range handling", () => {
  it("is inclusive at both ends", () => {
    const opseg = { od: "2026-01-10", do: "2026-01-12" };
    expect(uOpsegu("2026-01-10", opseg)).toBe(true);
    expect(uOpsegu("2026-01-12", opseg)).toBe(true);
    expect(uOpsegu("2026-01-09", opseg)).toBe(false);
    expect(uOpsegu("2026-01-13", opseg)).toBe(false);
  });

  it("puts a reversed custom range the right way round", () => {
    expect(normalizujOpseg({ od: "2026-02-01", do: "2026-01-01" })).toEqual({
      od: "2026-01-01",
      do: "2026-02-01",
    });
  });

  it("rejects a malformed range instead of quietly returning nothing", () => {
    expect(() => normalizujOpseg({ od: "2026-01-01", do: "" })).toThrow(
      /Neispravan opseg/,
    );
  });

  it("a single day is a range of one", () => {
    expect(opsegZaDan(DANAS)).toEqual({ od: DANAS, do: DANAS });
  });
});

describe("the filter badge", () => {
  it("counts the date filter once and each destination once", () => {
    expect(brojAktivnihFiltera({})).toBe(0);
    expect(brojAktivnihFiltera({ opseg: opsegZaDan(DANAS) })).toBe(1);
    expect(
      brojAktivnihFiltera({
        opseg: opsegZaCip("ovajMesec", DANAS),
        destinacije: ["drzava:grcka", "grad:x"],
      }),
    ).toBe(3);
  });
});

describe("which mode a filter state asks for", () => {
  it("a date filter turns Raspored into Dan", () => {
    expect(rezimPrikaza({ danas: DANAS })).toBe("raspored");
    expect(rezimPrikaza({ danas: DANAS, opseg: opsegZaDan(DANAS) })).toBe("dan");
  });

  it("search wins over Raspored but not over a date filter", () => {
    expect(rezimPrikaza({ danas: DANAS, pretraga: "marko" })).toBe("pretraga");
    expect(rezimPrikaza({ danas: DANAS, pretraga: "   " })).toBe("raspored");
    expect(
      rezimPrikaza({ danas: DANAS, pretraga: "marko", opseg: opsegZaDan(DANAS) }),
    ).toBe("dan");
  });

  it("a destination filter alone does not change the mode", () => {
    // Destination is a filter over whichever list is showing; only the date
    // filter changes what a row *is* (SPEC §2).
    expect(rezimPrikaza({ danas: DANAS, destinacije: ["drzava:grcka"] })).toBe(
      "raspored",
    );
  });
});
