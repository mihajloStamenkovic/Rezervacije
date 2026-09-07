/**
 * Price formatting.
 *
 * Written by hand rather than via `Intl`, so this suite also serves as the
 * proof that the output does not move with the host's ICU build — the same
 * reason `datum.test.ts` exists for dates.
 */
import { describe, expect, it } from "vitest";
import { formatCena } from "./novac";

describe("formatCena", () => {
  it("writes whole euros with the currency after the number", () => {
    expect(formatCena(480)).toBe("480 €");
    expect(formatCena(0)).toBe("0 €");
  });

  it("groups thousands with a full stop, as Serbian does", () => {
    expect(formatCena(1200)).toBe("1.200 €");
    expect(formatCena(12000)).toBe("12.000 €");
    expect(formatCena(100000)).toBe("100.000 €");
  });

  it("leaves three digits and fewer ungrouped", () => {
    expect(formatCena(7)).toBe("7 €");
    expect(formatCena(70)).toBe("70 €");
    expect(formatCena(700)).toBe("700 €");
  });
});
