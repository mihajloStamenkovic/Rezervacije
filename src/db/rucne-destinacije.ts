/**
 * Turning a destination the owner typed by hand into a row — SPEC §5, amended
 * 06.09.2026.
 *
 * This sits in `src/db/` rather than `src/domen/` because it has to read and
 * write the table: matching a typed name against the catalogue is domain logic
 * (`nadjiMesto`, `uskladiRegiju`, `sledeciRedosled` in `src/domen/kaskada.ts`,
 * all pure and all tested there), but deciding to INSERT is not. It is not in
 * `queries.ts` either, which is the raw-row layer and holds no policy.
 *
 * Both Server Actions that own a cascade — the reservation form and the
 * default-home-town setting — go through here, so a place typed on one screen
 * cannot be created by different rules than one typed on the other.
 */
import "server-only";
import { dodajDestinaciju } from "./queries";
import {
  nadjiGradUDrzavi,
  nadjiMesto,
  sledeciRedosled,
  uskladiRegiju,
  type NovoMesto,
} from "@/domen/kaskada";
import type { Destinacija } from "@/domen/tipovi";
import { T } from "@/lib/tekst";
import type { IzborDestinacije } from "@/lib/validacija";

/**
 * A leg's destination, resolved to an id the reservation can point at.
 *
 * **A picked id** is checked against `dozvoljene` — the same set the form's
 * dropdowns were built from, so the check and the UI cannot drift apart. A
 * Server Action is a public endpoint, and without this a hand-built POST could
 * name a destination the client no longer serves.
 *
 * **A typed place** is matched against the catalogue folded for case and
 * diacritics first, and inserted only when it is genuinely new. That matching
 * is the difference between one `Novi Marmaras` in the destination filter and
 * three. A match is accepted even when the row is inactive: typing the name is
 * an explicit request for that place, and answering it with "no longer in the
 * offer" would be a dead end with no way past it.
 *
 * The country is never typed, so a `drzavaSifra` that is in no row is a
 * tampered submission rather than a new country, and is refused.
 *
 * `katalog` is mutated on insert, so a booking that types the same new town
 * into both legs creates one row and points both legs at it.
 */
/**
 * The region a typed place belongs to: what was typed, or the town itself.
 *
 * The Povratak leg has no region field at all and Odlazak's is optional, so a
 * town frequently arrives without one. Making it its own region is not a
 * placeholder — it is the shape the seed already uses for exactly this case:
 * `Srbija › Beograd › Beograd`, `Srbija › Kopaonik › Kopaonik`. It keeps the
 * three-level cascade on the outbound leg working without a special case, and
 * it reads correctly wherever the full path is displayed.
 */
function regijaZa(novo: NovoMesto): string {
  const upisana = novo.regija.trim();
  return upisana === "" ? novo.grad.trim() : upisana;
}

export async function razresiDestinaciju(
  izbor: IzborDestinacije,
  katalog: Destinacija[],
  dozvoljene: ReadonlySet<string>,
): Promise<{ id: string } | { greska: string }> {
  const novo = izbor.novo;
  if (novo === null) {
    return dozvoljene.has(izbor.id)
      ? { id: izbor.id }
      : { greska: T.greske.destinacijaNijeUPonudi };
  }

  /*
   * Match before creating. Which of the two lookups applies depends on whether
   * a region was given: with one, the town must match in that region; without
   * one, anywhere in the country. Using the town's own name as its region here
   * would miss `Grčka › Kasandra › Hanioti` and add a second Hanioti — and the
   * Povratak leg, which never asks for a region, is where that would happen
   * most.
   */
  const postojece =
    novo.regija.trim() === ""
      ? nadjiGradUDrzavi(katalog, novo.drzavaSifra, novo.grad)
      : nadjiMesto(katalog, novo);
  if (postojece !== null) return { id: postojece.id };

  const drzava = katalog.find((d) => d.drzavaSifra === novo.drzavaSifra);
  if (drzava === undefined) return { greska: T.greske.destinacijaObavezna };

  const red = await dodajDestinaciju({
    drzava: drzava.drzava,
    drzavaSifra: drzava.drzavaSifra,
    regija: uskladiRegiju(katalog, drzava.drzavaSifra, regijaZa(novo)),
    grad: novo.grad,
    aktivna: true,
    redosled: sledeciRedosled(katalog, drzava.drzavaSifra),
  });
  katalog.push(red);
  return { id: red.id };
}
