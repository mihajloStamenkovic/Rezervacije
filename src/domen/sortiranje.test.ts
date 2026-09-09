import { describe, expect, it } from "vitest";
import type { Destinacija } from "./tipovi";
import { DANAS, HANIOTI, KOPAONIK, SVI, dan, imena, red } from "./fiksture";
import { danView, rasporedView } from "./liste";
import { opsegZaDan } from "./filteri";
import { sortirajStavke } from "./sortiranje";
import { etapaPolaska } from "./glavna-etapa";

/** A one-off destination, so the collation cases can use real Serbian towns. */
function mesto(n: number, grad: string): Destinacija {
  return {
    id: `00000000-0000-4000-8000-3000000000${String(n).padStart(2, "0")}`,
    drzava: "Srbija",
    drzavaSifra: "srbija",
    regija: grad,
    grad,
    aktivna: true,
    redosled: n,
  };
}

const stavkeOd = (redovi: ReturnType<typeof red>[]) =>
  redovi.map((r) => ({
    ...etapaPolaska(r),
    red: r,
    kljuc: `${r.rezervacija.id}#odlazak`,
  }));

describe("same-day order — SPEC §2", () => {
  it("1. departures before returns", () => {
    // #6 is a same-day round trip: both its legs land on the same date, and
    // the departure has to come first however the rows arrived.
    const stavke = danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(2)) });
    expect(stavke.map((s) => s.smer)).toEqual([
      "odlazak",
      "odlazak",
      "povratak",
    ]);
  });

  it("2. then destination A–Z", () => {
    // Two departures on dan(2): Hanioti (#8) and Kopaonik (#6).
    const stavke = danView(SVI, { danas: DANAS, opseg: opsegZaDan(dan(2)) });
    expect(stavke.slice(0, 2).map((s) => s.destinacija.grad)).toEqual([
      "Hanioti",
      "Kopaonik",
    ]);
    expect(HANIOTI.grad < KOPAONIK.grad).toBe(true);
  });

  it("3. then name A–Z", () => {
    const isti = mesto(1, "Hanioti");
    // Ordered so a byte sort gets it wrong: sr-Latn puts Č between C and D,
    // while UTF-16 puts it after Z.
    const redovi = [
      "Živko Ilić",
      "Šaban Šaulić",
      "Čedomir Rakić",
      "Ana Marković",
      "Dragan Ilić",
      "Cvetko Ilić",
    ].map(
      (ime, i) =>
        red({
          n: 40 + i,
          ime,
          telefon: "+381600000000",
          destinacija: isti,
          datumPolaska: dan(5),
          brojPutnika: 1,
        }),
    );
    expect(imena(sortirajStavke(stavkeOd(redovi)))).toEqual([
      "Ana Marković",
      "Cvetko Ilić",
      "Čedomir Rakić",
      "Dragan Ilić",
      "Šaban Šaulić",
      "Živko Ilić",
    ]);
  });

  it("destination A–Z uses the sr-Latn collator, not ASCII bytes", () => {
    // Č after C, Š after S, Ž after Z — a byte sort puts all three after Z,
    // and a bare localeCompare() depends on the machine's locale.
    const gradovi = ["Zagreb", "Čačak", "Cetinje", "Šabac", "Žabalj"];
    const redovi = gradovi.map((grad, i) =>
      red({
        n: 50 + i,
        ime: "Isti Putnik",
        telefon: "+381600000000",
        destinacija: mesto(50 + i, grad),
        datumPolaska: dan(5),
        brojPutnika: 1,
      }),
    );
    expect(
      sortirajStavke(stavkeOd(redovi)).map((s) => s.destinacija.grad),
    ).toEqual(["Cetinje", "Čačak", "Šabac", "Zagreb", "Žabalj"]);
  });
});

describe("stability", () => {
  it("is the same list whatever order the rows arrive in", () => {
    const ocekivano = rasporedView(SVI, { danas: DANAS }).map((s) => s.kljuc);
    const permutacije = [
      [...SVI].reverse(),
      [...SVI].sort((a, b) =>
        a.rezervacija.ime < b.rezervacija.ime ? -1 : 1,
      ),
      [...SVI].sort((a, b) =>
        a.rezervacija.id > b.rezervacija.id ? -1 : 1,
      ),
    ];
    for (const redosled of permutacije) {
      expect(rasporedView(redosled, { danas: DANAS }).map((s) => s.kljuc)).toEqual(
        ocekivano,
      );
    }
  });

  it("breaks a full tie on reservation id, so the order is total", () => {
    // Same date, same direction, same destination, same name: without a final
    // tiebreak these two would sit in whatever order Postgres returned them.
    const isti = mesto(2, "Sarti");
    const a = red({
      n: 60,
      ime: "Isto Ime",
      telefon: "+381600000000",
      destinacija: isti,
      datumPolaska: dan(5),
      brojPutnika: 1,
    });
    const b = red({
      n: 61,
      ime: "Isto Ime",
      telefon: "+381600000000",
      destinacija: isti,
      datumPolaska: dan(5),
      brojPutnika: 1,
    });
    expect(sortirajStavke(stavkeOd([b, a])).map((s) => s.kljuc)).toEqual(
      sortirajStavke(stavkeOd([a, b])).map((s) => s.kljuc),
    );
  });

  it("never mutates the array it is given", () => {
    const ulaz = stavkeOd([...SVI]);
    const kopija = [...ulaz];
    sortirajStavke(ulaz);
    expect(ulaz).toEqual(kopija);
  });
});

/**
 * There used to be a *Sortiranje* section in the filter sheet — date or
 * destination, ascending or descending. The owner had it removed on
 * 09.09.2026. These are the tests that keep it removed: there is one order,
 * `sortirajStavke` takes nothing but the rows, and every view produces the
 * same sequence.
 */
describe("one order and no choice — SPEC §3, amended 09.09.2026", () => {
  it("dates run ascending in every mode", () => {
    const raspored = rasporedView(SVI, { danas: DANAS }).map((s) => s.datum);
    expect(raspored).toEqual([...raspored].sort());

    const dan30 = danView(SVI, {
      danas: DANAS,
      opseg: { od: dan(-30), do: dan(30) },
    }).map((s) => s.datum);
    expect(dan30).toEqual([...dan30].sort());
  });

  it("sorts by date first, so a destination never groups the list", () => {
    // Under the old destination sort these seven Beograd legs sat together.
    // Now they are wherever their dates put them, scattered through the list.
    const stavke = rasporedView(SVI, { danas: DANAS });
    const beogradi = stavke
      .map((s, i) => (s.destinacija.grad === "Beograd" ? i : -1))
      .filter((i) => i >= 0);
    expect(beogradi.length).toBe(7);
    expect(beogradi).not.toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
