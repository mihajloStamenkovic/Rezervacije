import { describe, expect, it } from "vitest";
import { ADMIN, BIVSI, MARIJA, NIKOLA, STEFAN, TIM_A, TIM_B } from "./fiksture";
import {
  jeAdmin,
  mozeVideti,
  mozeVidetiProfil,
  podrazumevaniTim,
  smeDaDodeli,
} from "./pristup";

describe("jeAdmin", () => {
  it("is the role and nothing else", () => {
    expect(jeAdmin(ADMIN)).toBe(true);
    expect(jeAdmin(NIKOLA)).toBe(false);
    // Not "has no team" — that is a consequence of being an admin, not the
    // definition. Reading it the other way round would turn a misconfigured
    // row into a superuser.
    expect(jeAdmin({ uloga: "korisnik" })).toBe(false);
  });
});

describe("mozeVideti — the rule the whole change exists for", () => {
  it("a driver sees their own team's bookings", () => {
    expect(mozeVideti(NIKOLA, TIM_A)).toBe(true);
    expect(mozeVideti(MARIJA, TIM_A)).toBe(true);
  });

  it("a driver never sees another team's bookings", () => {
    expect(mozeVideti(NIKOLA, TIM_B)).toBe(false);
    expect(mozeVideti(STEFAN, TIM_A)).toBe(false);
  });

  it("visibility inside a team is mutual", () => {
    // The property the owners chose teams for.
    for (const tim of [TIM_A, TIM_B]) {
      for (const a of [NIKOLA, MARIJA, STEFAN]) {
        for (const b of [NIKOLA, MARIJA, STEFAN]) {
          if (a.timId === b.timId) {
            expect(mozeVideti(a, tim)).toBe(mozeVideti(b, tim));
          }
        }
      }
    }
  });

  it("an admin sees every team", () => {
    expect(mozeVideti(ADMIN, TIM_A)).toBe(true);
    expect(mozeVideti(ADMIN, TIM_B)).toBe(true);
  });

  it("an admin-only booking is visible to admins and to nobody else", () => {
    expect(mozeVideti(ADMIN, null)).toBe(true);
    expect(mozeVideti(NIKOLA, null)).toBe(false);
    expect(mozeVideti(STEFAN, null)).toBe(false);
  });

  it("two nulls never match", () => {
    // The bug this rule is most likely to grow: a korisnik with no team (which
    // the CHECK constraint forbids, but a rule that leans on a constraint
    // holding is a rule that fails the day it does not) must not thereby see
    // every administrators-only booking in the database.
    expect(mozeVideti({ uloga: "korisnik", timId: null }, null)).toBe(false);
  });

  it("deactivating someone does not hide their team's bookings", () => {
    // `aktivan` governs signing in, not visibility. The team still has to
    // drive the trips this person booked before they left.
    expect(BIVSI.aktivan).toBe(false);
    expect(BIVSI.timId).toBe(TIM_A);
    expect(mozeVideti(NIKOLA, TIM_A)).toBe(true);
  });
});

describe("podrazumevaniTim — what the form fills in unasked", () => {
  it("files a driver's booking under that driver's team", () => {
    expect(podrazumevaniTim(NIKOLA)).toBe(TIM_A);
    expect(podrazumevaniTim(STEFAN)).toBe(TIM_B);
  });

  it("gives an admin no team, so the form has to ask", () => {
    // An admin accepting this default silently is the failure the whole
    // stored-team design exists to prevent: a real trip no driver can see.
    expect(podrazumevaniTim(ADMIN)).toBeNull();
  });
});

describe("smeDaDodeli — who may file under which team", () => {
  it("a driver may only file under their own team", () => {
    expect(smeDaDodeli(NIKOLA, TIM_A)).toBe(true);
    expect(smeDaDodeli(NIKOLA, TIM_B)).toBe(false);
    // Not even administrators-only: that would let a driver hide a booking
    // from the crew that has to drive it.
    expect(smeDaDodeli(NIKOLA, null)).toBe(false);
  });

  it("an admin may file under any team, or under none", () => {
    expect(smeDaDodeli(ADMIN, TIM_A)).toBe(true);
    expect(smeDaDodeli(ADMIN, TIM_B)).toBe(true);
    expect(smeDaDodeli(ADMIN, null)).toBe(true);
  });

  it("anything a driver may file, that driver may then see", () => {
    // These two rules have to agree, or somebody can write a booking that
    // vanishes the moment they save it.
    for (const tim of [TIM_A, TIM_B, null]) {
      if (smeDaDodeli(NIKOLA, tim)) expect(mozeVideti(NIKOLA, tim)).toBe(true);
      if (smeDaDodeli(STEFAN, tim)) expect(mozeVideti(STEFAN, tim)).toBe(true);
    }
  });
});

describe("mozeVidetiProfil — who a driver knows exists", () => {
  it("hides accounts outside the team, admins included", () => {
    expect(mozeVidetiProfil(NIKOLA, MARIJA)).toBe(true);
    expect(mozeVidetiProfil(NIKOLA, STEFAN)).toBe(false);
    expect(mozeVidetiProfil(NIKOLA, ADMIN)).toBe(false);
  });

  it("everyone can always see themselves", () => {
    // Without this an admin disappears from their own member list, because an
    // admin is on no team.
    expect(mozeVidetiProfil(ADMIN, ADMIN)).toBe(true);
    expect(mozeVidetiProfil(NIKOLA, NIKOLA)).toBe(true);
  });

  it("an admin sees every account", () => {
    expect(mozeVidetiProfil(ADMIN, NIKOLA)).toBe(true);
    expect(mozeVidetiProfil(ADMIN, STEFAN)).toBe(true);
  });
});
