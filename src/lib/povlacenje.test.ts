/**
 * Pull-to-refresh arithmetic.
 *
 * The case that matters is the first one: a normal upward scroll must produce
 * exactly zero movement, or the indicator would peek out every time the owner
 * flicks the schedule and the gesture would read as a glitch.
 */
import { describe, expect, it } from "vitest";
import { MAKS, PRAG, jeArmirano, napredak, pomerajZa } from "./povlacenje";

describe("pomerajZa", () => {
  it("shows nothing for an upward or motionless finger", () => {
    expect(pomerajZa(-120)).toBe(0);
    expect(pomerajZa(-1)).toBe(0);
    expect(pomerajZa(0)).toBe(0);
  });

  it("moves at half the speed of the finger", () => {
    expect(pomerajZa(40)).toBe(20);
    expect(pomerajZa(100)).toBe(50);
  });

  it("stops at the cap however hard the pull", () => {
    expect(pomerajZa(10_000)).toBe(MAKS);
  });
});

describe("jeArmirano", () => {
  it("arms only at the threshold, not before it", () => {
    expect(jeArmirano(PRAG - 1)).toBe(false);
    expect(jeArmirano(PRAG)).toBe(true);
  });

  /**
   * The resistance means the finger travels twice the offset, so the gesture
   * costs a real pull rather than a twitch. Written out because the two
   * constants are easy to change independently and this is the relationship
   * between them that decides how the app feels.
   */
  it("needs the finger to travel twice the threshold", () => {
    expect(jeArmirano(pomerajZa(PRAG * 2 - 2))).toBe(false);
    expect(jeArmirano(pomerajZa(PRAG * 2))).toBe(true);
  });
});

describe("napredak", () => {
  it("runs 0…1 and never past 1", () => {
    expect(napredak(0)).toBe(0);
    expect(napredak(PRAG / 2)).toBe(0.5);
    expect(napredak(PRAG)).toBe(1);
    expect(napredak(MAKS)).toBe(1);
  });
});
