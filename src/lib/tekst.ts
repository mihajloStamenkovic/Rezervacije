/**
 * Every user-facing string in the app, Serbian, Latin script.
 *
 * One file so the wording can be read and corrected in one sitting, and so
 * "zero Serbian strings inlined in JSX" is a rule a reviewer can actually
 * check. Components import from here; they never spell a word themselves.
 */

export const T = {
  app: {
    naziv: "Kombi Rezervacije",
    opis: "Zajednička knjiga rezervacija za kombi prevoz.",
  },

  prijava: {
    naslov: "Prijava",
    email: "Email",
    lozinka: "Lozinka",
    dugme: "Prijavi se",
    uToku: "Prijavljivanje…",
    greska: "Pogrešan email ili lozinka.",
    odjava: "Odjavi se",
  },

  lista: {
    naslov: "Raspored",
    /** Headings for the other two list shapes — SPEC §2 and the Phase 3 note. */
    naslovDan: "Dan",
    naslovPretraga: "Pretraga",
    prazno: "Nema nadolazećih rezervacija.",
    prazoUzFilter: "Nijedna rezervacija ne odgovara filteru.",
    praznoPretraga: "Nema rezultata za ovu pretragu.",
    novaRezervacija: "Nova rezervacija",
    pretraga: "Pretraži ime, telefon ili destinaciju",
    obrisiPretragu: "Obriši pretragu",
    ucitavanje: "Učitavanje…",
    /** Screen-reader label on the card link; the card itself shows the name. */
    otvori: "Otvori rezervaciju",
  },

  nav: {
    nazad: "Nazad",
    podesavanja: "Podešavanja",
  },

  smer: {
    odlazak: "Odlazak",
    povratak: "Povratak",
    /** Chips carry the arrow; the arrow is content, not decoration. */
    odlazakSaStrelicom: "↑ Odlazak",
    povratakSaStrelicom: "↓ Povratak",
  },

  grupa: {
    polasci: "Polasci",
    povratci: "Povratci",
  },

  filter: {
    naslov: "Filter",
    dugme: "Filter",
    primeni: "Primeni",
    obrisiSve: "Obriši sve",
    zatvori: "Zatvori",
    datum: "Datum",
    danas: "danas",
    ovaNedelja: "ova nedelja",
    ovajMesec: "ovaj mesec",
    opseg: "Izaberi opseg",
    odDatuma: "Od",
    doDatuma: "Do",
    destinacija: "Destinacija",
    sveDrzave: "Sve države",
    aktivnihFiltera: "aktivnih filtera",
  },

  sortiranje: {
    naslov: "Sortiranje",
    poDatumu: "Po datumu",
    poDestinaciji: "Po destinaciji",
    rastuce: "Rastuće",
    opadajuce: "Opadajuće",
  },

  forma: {
    naslovNova: "Nova rezervacija",
    naslovIzmena: "Izmeni rezervaciju",
    ime: "Ime",
    imePlaceholder: "Ime i prezime",
    telefon: "Telefon",
    telefonPlaceholder: "064 123 4567",
    telefonPomoc: "Čuva se kao +381… da bi radilo i iz inostranstva.",
    brojPutnika: "Broj putnika",
    odlazak: "Odlazak",
    povratak: "Povratak",
    drzava: "Država",
    regija: "Regija",
    grad: "Grad",
    izaberi: "Izaberi…",
    datumPolaska: "Datum polaska",
    datumPovratka: "Datum povratka",
    datumPovratkaPomoc: "Ostavi prazno ako povratak još nije dogovoren.",
    zameni: "Zameni polazak i povratak",
    sacuvaj: "Sačuvaj",
    cuvanje: "Čuvanje…",
    odustani: "Odustani",
  },

  detalji: {
    naslov: "Rezervacija",
    pozovi: "Pozovi",
    whatsapp: "WhatsApp",
    izmeni: "Izmeni",
    obrisi: "Obriši",
    uneo: "Uneo",
    polazak: "Polazak",
    povratak: "Povratak",
    bezPovratka: "Povratak nije dogovoren",
  },

  brisanje: {
    naslov: "Obrisati rezervaciju?",
    /** No undo, no recycle bin — the dialog is the only guard (SPEC §8). */
    poruka: "Brisanje je trajno. Rezervacija se ne može vratiti.",
    potvrdi: "Obriši",
    odustani: "Odustani",
  },

  podesavanja: {
    naslov: "Podešavanja",
    podrazumevaniGrad: "Podrazumevano mesto povratka",
    podrazumevaniGradPomoc:
      "Unapred se popunjava u polju povratka kod nove rezervacije.",
    sacuvano: "Sačuvano.",
  },

  mreza: {
    offline: "Nema veze sa internetom",
    offlineCuvanje: "Za čuvanje je potrebna internet veza.",
  },

  greske: {
    imeObavezno: "Unesi ime.",
    telefonObavezan: "Unesi broj telefona.",
    telefonNeispravan: "Broj telefona nije ispravan.",
    destinacijaObavezna: "Izaberi destinaciju.",
    datumPolaskaObavezan: "Izaberi datum polaska.",
    datumNeispravan: "Datum nije ispravan.",
    povratakPrePolaska: "Povratak ne može biti pre polaska.",
    brojPutnikaObavezan: "Unesi broj putnika.",
    brojPutnikaNeispravan: "Broj putnika mora biti veći od nule.",
    nijeNadjeno: "Rezervacija nije pronađena.",
    neuspelo: "Čuvanje nije uspelo. Pokušaj ponovo.",
  },
} as const;

/**
 * Serbian plural selection.
 *
 * Three forms, and the boundaries are not where an English speaker expects:
 * 21 takes the *singular* (`21 putnik`), 5 takes the many form, and 11–14 are
 * an exception to the rule that would otherwise catch them.
 */
export function srpskiOblik(n: number): "jedan" | "malo" | "mnogo" {
  const apsolutno = Math.abs(Math.trunc(n));
  const desetice = apsolutno % 100;
  const jedinice = apsolutno % 10;

  if (jedinice === 1 && desetice !== 11) return "jedan";
  if (jedinice >= 2 && jedinice <= 4 && (desetice < 12 || desetice > 14)) {
    return "malo";
  }
  return "mnogo";
}

function pluralizuj(
  n: number,
  oblici: { jedan: string; malo: string; mnogo: string },
): string {
  return `${n} ${oblici[srpskiOblik(n)]}`;
}

/** `1 putnik` · `2 putnika` · `5 putnika` · `21 putnik`. */
export function putnika(n: number): string {
  return pluralizuj(n, {
    jedan: "putnik",
    malo: "putnika",
    mnogo: "putnika",
  });
}

/** `1 rezervacija` · `2 rezervacije` · `5 rezervacija` · `21 rezervacija`. */
export function rezervacija(n: number): string {
  return pluralizuj(n, {
    jedan: "rezervacija",
    malo: "rezervacije",
    mnogo: "rezervacija",
  });
}

/** `1 filter` · `2 filtera` · `5 filtera`. */
export function filtera(n: number): string {
  return pluralizuj(n, {
    jedan: "filter",
    malo: "filtera",
    mnogo: "filtera",
  });
}

/**
 * The one collator for the whole app.
 *
 * `sr-Latn` puts Č after C, Ć after Č, Đ after D, Š after S and Ž after Z.
 * Plain `sr` is the Cyrillic order and gets Latin text wrong (`Čačak` sorts
 * before `Cetinje`), and a default `localeCompare()` gets it wrong differently
 * depending on where it runs. Sorting must not depend on the machine.
 */
const kolator = new Intl.Collator("sr-Latn", {
  numeric: true,
  sensitivity: "variant",
});

export function uporediTekst(a: string, b: string): number {
  return kolator.compare(a, b);
}
