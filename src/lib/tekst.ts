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
    /** What fits under a home screen icon. iOS truncates past ~12 characters. */
    kratakNaziv: "Rezervacije",
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
    /**
     * The ✕ on a Dialog or a Sheet. Lives here rather than under `filter`
     * because both primitives render it — the delete confirmation uses it too,
     * and a filter-namespaced string on a delete dialog reads as a mistake.
     */
    zatvori: "Zatvori",
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
    jednosmerno: "Jednosmerna vožnja",
    jednosmernoPomoc: "Bez povratka — samo jedan put i jedan datum.",
    odakle: "Odakle",
    kuda: "Kuda",
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
    odakle: "Odakle",
    kuda: "Kuda",
    jednosmerno: "Jednosmerna vožnja",
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
    /** The bar says what is on screen, not only what is missing. */
    offlineOpis: "Prikazani su poslednji poznati podaci.",
    offlineCuvanje: "Za čuvanje je potrebna internet veza.",
    offlineBrisanje: "Za brisanje je potrebna internet veza.",
  },

  instalacija: {
    naslov: "Dodaj na početni ekran",
    opis: "Otvara se kao aplikacija, preko celog ekrana, bez adresne trake.",
    dugme: "Dodaj",
    /*
     * iOS has no install prompt and no API to trigger one, so on iPhone the
     * only thing that can be offered is the instruction. It names the icon by
     * shape rather than by label, because Safari's own wording depends on the
     * phone's language and this phone may well be in English.
     */
    uputstvoIos:
      "U Safariju dodirni dugme za deljenje (kvadrat sa strelicom naviše), pa „Add to Home Screen“.",
    odbaci: "Ne sada",
  },

  greske: {
    imeObavezno: "Unesi ime.",
    telefonObavezan: "Unesi broj telefona.",
    telefonNeispravan: "Broj telefona nije ispravan.",
    destinacijaObavezna: "Izaberi destinaciju.",
    /** The id parsed, but names a destination that is no longer offered. */
    destinacijaNijeUPonudi: "Ta destinacija više nije u ponudi.",
    datumPolaskaObavezan: "Izaberi datum polaska.",
    datumNeispravan: "Datum nije ispravan.",
    povratakPrePolaska: "Povratak ne može biti pre polaska.",
    brojPutnikaObavezan: "Unesi broj putnika.",
    /**
     * Covers zero, negatives, decimals and exponent/hex notation in one
     * sentence. The old wording said only "greater than zero", which was the
     * wrong reason for `1.5`.
     */
    brojPutnikaNeispravan: "Broj putnika mora biti ceo broj veći od nule.",
    brojPutnikaPrevelik: "Najviše 100 putnika po rezervaciji.",
    nijeNadjeno: "Rezervacija nije pronađena.",
    neuspelo: "Čuvanje nije uspelo. Pokušaj ponovo.",
    /**
     * A hand-built POST naming a team the signed-in person may not file under.
     * The dropdown never offers one, so nobody reaches this by tapping.
     */
    timNijeDozvoljen: "Nemaš pravo da rezervaciju dodeliš tom timu.",
  },

  /** Teams and roles — the admin's own screens. */
  timovi: {
    naslov: "Nalozi",
    tim: "Tim",
    timovi: "Timovi",
    korisnici: "Nalozi",
    noviTim: "Novi tim",
    naziv: "Naziv tima",
    dodaj: "Dodaj",
    noviNalog: "Novi nalog",
    ime: "Ime",
    email: "E-mail",
    lozinka: "Lozinka",
    lozinkaPomoc: "Najmanje 12 znakova. Reci je vozacu licno.",
    boja: "Boja bedza",
    napravi: "Napravi nalog",
    administrator: "Administrator",
    vozac: "Vozač",
    aktivan: "Ima pristup",
    neaktivan: "Nema pristup",
    zakljucaj: "Oduzmi pristup",
    otkljucaj: "Vrati pristup",
    bezTima: "Bez tima",
    nemaNaloga: "Još nema naloga.",
    nemaTimova: "Napravi prvo tim, pa onda nalog.",
    /**
     * Deletion is impossible here and saying so is kinder than a button that
     * fails: `reservations.kreirao` is ON DELETE RESTRICT.
     */
    zastoNemaBrisanja:
      "Nalog se ne briše — rezervacije koje je uneo moraju da ostanu. Oduzmi mu pristup.",
    nazivObavezan: "Unesi naziv tima.",
    imeObavezno: "Unesi ime.",
    emailNeispravan: "E-mail nije ispravan.",
    lozinkaKratka: "Lozinka mora imati najmanje 12 znakova.",
    bojaNeispravna: "Izaberi boju.",
    timObavezan: "Izaberi tim.",
    timPostoji: "Tim sa tim nazivom već postoji.",
    nalogNeuspeo: "Nalog nije napravljen. Proveri e-mail i pokušaj ponovo.",
    /**
     * A deployment fault, not a typing mistake — so it says so, and names the
     * thing to fix. Anything vaguer sends the owner round the form again.
     */
    nedostajeKljuc:
      "Server nema Supabase tajni ključ, pa ne može da napravi nalog. " +
      "Dodaj SUPABASE_SECRET_KEY na Vercel.",
    /** The dropdown option that files a booking away from every driver. */
    samoAdmini: "Samo administratori",
    /**
     * Shown on the form whenever the chosen team is "administrators only".
     * The owners chose to keep that option; this is what stops it becoming a
     * trip nobody driving can see.
     */
    samoAdminiUpozorenje:
      "Ovu rezervaciju neće videti nijedan vozač — samo administratori.",
    zaKoga: "Ko vidi rezervaciju",
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
