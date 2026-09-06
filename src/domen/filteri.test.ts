import { describe, expect, it } from "vitest";
import {
  brojAktivnihFiltera,
  normalizujOpseg,
  opsegZaCip,
  opsegZaDan,
  postaviKrajOpsega,
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

describe("postaviKrajOpsega — editing one end of the custom range", () => {
  // The bug this function exists to prevent, reported 06.09.2026: with the
  // *danas* chip on, typing a future date into *Od datuma* read back as
  // Od = today and Do = the typed date. The date landed in the box the user
  // was not typing in.
  it("keeps a future Od in Od and pushes Do out to meet it", () => {
    expect(
      postaviKrajOpsega({ od: DANAS, do: DANAS }, "od", "2026-01-20"),
    ).toEqual({ od: "2026-01-20", do: "2026-01-20" });
  });

  it("keeps a past Do in Do and pulls Od back to meet it", () => {
    expect(
      postaviKrajOpsega({ od: DANAS, do: "2026-01-20" }, "do", "2026-01-05"),
    ).toEqual({ od: "2026-01-05", do: "2026-01-05" });
  });

  it("never moves the typed date into the other end", () => {
    // The property the swap violated: whichever end was edited holds the
    // typed value afterwards, whatever the other end was.
    for (const drugi of ["2026-01-01", DANAS, "2026-12-31"]) {
      const opseg = { od: drugi, do: drugi };
      expect(postaviKrajOpsega(opseg, "od", "2026-06-15")?.od).toBe("2026-06-15");
      expect(postaviKrajOpsega(opseg, "do", "2026-06-15")?.do).toBe("2026-06-15");
    }
  });

  it("widens the range when the edit does not invert it", () => {
    expect(
      postaviKrajOpsega({ od: DANAS, do: "2026-01-20" }, "od", "2026-01-10"),
    ).toEqual({ od: "2026-01-10", do: "2026-01-20" });
    expect(
      postaviKrajOpsega({ od: DANAS, do: "2026-01-20" }, "do", "2026-01-31"),
    ).toEqual({ od: DANAS, do: "2026-01-31" });
  });

  it("the first date typed into an empty filter becomes a single day", () => {
    expect(postaviKrajOpsega(null, "od", "2026-01-20")).toEqual({
      od: "2026-01-20",
      do: "2026-01-20",
    });
    expect(postaviKrajOpsega(null, "do", "2026-01-20")).toEqual({
      od: "2026-01-20",
      do: "2026-01-20",
    });
  });

  it("clearing one end leaves the other standing as a single day", () => {
    expect(
      postaviKrajOpsega({ od: DANAS, do: "2026-01-20" }, "od", ""),
    ).toEqual({ od: "2026-01-20", do: "2026-01-20" });
    expect(
      postaviKrajOpsega({ od: DANAS, do: "2026-01-20" }, "do", ""),
    ).toEqual({ od: DANAS, do: DANAS });
  });

  it("clearing the last date turns the date filter off", () => {
    expect(postaviKrajOpsega({ od: DANAS, do: DANAS }, "od", "")).toEqual({
      od: DANAS,
      do: DANAS,
    });
    expect(postaviKrajOpsega(null, "od", "")).toBeNull();
  });

  it("a half-typed date is treated as no date, not as a range", () => {
    // Native date inputs emit "" mid-edit; a malformed string must never
    // reach the `>=` comparison the whole app hinges on.
    expect(postaviKrajOpsega(null, "od", "2026-1-5")).toBeNull();
    expect(postaviKrajOpsega({ od: DANAS, do: DANAS }, "do", "sutra")).toEqual({
      od: DANAS,
      do: DANAS,
    });
  });
});
