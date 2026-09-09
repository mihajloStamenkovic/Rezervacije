/**
 * Swipe-between-tabs arithmetic.
 *
 * The case that matters is the diagonal one: the list is scrolled far more
 * often than the tab is changed, so a finger going mostly down must never be
 * read as a swipe. Getting that wrong does not look like a bug — it looks like
 * the app changing tab on its own while somebody reads the schedule.
 */
import { describe, expect, it } from "vitest";
import {
  NAJMANJI_PRAG,
  PRAG_OSE,
  odlukaOse,
  pomerajPrevlacenja,
  prebacujeLi,
  susedniIndeks,
} from "./prevlacenje";

describe("odlukaOse", () => {
  it("says nothing at all until the finger has really moved", () => {
    expect(odlukaOse(0, 0)).toBeNull();
    expect(odlukaOse(PRAG_OSE - 1, PRAG_OSE - 1)).toBeNull();
    expect(odlukaOse(-(PRAG_OSE - 1), 0)).toBeNull();
  });

  it("reads a flat drag as a swipe, either way", () => {
    expect(odlukaOse(60, 4)).toBe("x");
    expect(odlukaOse(-60, -4)).toBe("x");
  });

  it("reads a scroll as a scroll", () => {
    expect(odlukaOse(0, 60)).toBe("y");
    expect(odlukaOse(4, -60)).toBe("y");
  });

  it("gives a diagonal to the scroll, because that is the safer mistake", () => {
    // Equal travel in both directions is a scroll, and so is anything the
    // horizontal does not win by a clear margin.
    expect(odlukaOse(40, 40)).toBe("y");
    expect(odlukaOse(40, 30)).toBe("y");
    expect(odlukaOse(50, 30)).toBe("x");
  });
});

describe("pomerajPrevlacenja", () => {
  it("follows the finger exactly when there is a tab to reveal", () => {
    expect(pomerajPrevlacenja(-80, true)).toBe(-80);
    expect(pomerajPrevlacenja(120, true)).toBe(120);
  });

  it("resists at the end, so the edge is felt rather than announced", () => {
    expect(pomerajPrevlacenja(80, false)).toBe(20);
    expect(pomerajPrevlacenja(-80, false)).toBe(-20);
  });
});

describe("prebacujeLi", () => {
  it("needs a quarter of the screen", () => {
    expect(prebacujeLi(99, 400)).toBe(false);
    expect(prebacujeLi(100, 400)).toBe(true);
    expect(prebacujeLi(-100, 400)).toBe(true);
  });

  it("never asks for less than the floor, however narrow the phone", () => {
    expect(prebacujeLi(NAJMANJI_PRAG - 1, 120)).toBe(false);
    expect(prebacujeLi(NAJMANJI_PRAG, 120)).toBe(true);
  });

  it("a tap changes nothing", () => {
    expect(prebacujeLi(0, 400)).toBe(false);
  });
});

describe("susedniIndeks", () => {
  it("dragging left brings the next tab in from the right", () => {
    expect(susedniIndeks(0, -80, 2)).toBe(1);
    expect(susedniIndeks(1, 80, 2)).toBe(0);
  });

  it("has nothing to offer past either end", () => {
    expect(susedniIndeks(0, 80, 2)).toBeNull();
    expect(susedniIndeks(1, -80, 2)).toBeNull();
  });

  it("a motionless finger reveals nothing", () => {
    expect(susedniIndeks(0, 0, 2)).toBeNull();
  });
});
