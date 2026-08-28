import { describe, expect, it } from "vitest";
import {
  formatTelefon,
  jeIspravanTelefon,
  normalizujTelefon,
  telLink,
  whatsAppLink,
} from "./telefon";

describe("normalizujTelefon", () => {
  it.each([
    ["064 123 4567", "+381641234567"],
    ["0641234567", "+381641234567"],
    ["064/123-4567", "+381641234567"],
    ["+381 64 123 4567", "+381641234567"],
    ["00381641234567", "+381641234567"],
    ["381641234567", "+381641234567"],
  ])("%s → %s", (unos, ocekivano) => {
    expect(normalizujTelefon(unos)).toBe(ocekivano);
  });

  it("keeps a foreign number's own country code", () => {
    // The owner drives Greeks home too.
    expect(normalizujTelefon("+30 694 123 4567")).toBe("+306941234567");
  });

  it.each(["", "   ", "abc", "123", "064 12"])(
    "rejects %o",
    (unos) => {
      expect(normalizujTelefon(unos)).toBeNull();
      expect(jeIspravanTelefon(unos)).toBe(false);
    },
  );
});

describe("links", () => {
  it("dials E.164, not the pretty form", () => {
    expect(telLink("+381641234567")).toBe("tel:+381641234567");
  });

  it("gives wa.me digits only", () => {
    expect(whatsAppLink("+381641234567")).toBe("https://wa.me/381641234567");
  });

  it("survives being handed an unnormalised number", () => {
    expect(whatsAppLink("+381 64 123 4567")).toBe("https://wa.me/381641234567");
  });
});

describe("formatTelefon", () => {
  it("shows the country code, because it is read from abroad", () => {
    // libphonenumber's grouping for RS mobiles, not ours to invent.
    expect(formatTelefon("+381641234567")).toBe("+381 64 1234567");
  });

  it("hands back anything it cannot parse rather than dropping it", () => {
    expect(formatTelefon("nesto")).toBe("nesto");
  });
});
