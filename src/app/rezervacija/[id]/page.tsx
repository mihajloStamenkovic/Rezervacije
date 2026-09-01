/**
 * Detalji — SPEC §6, screen 4.
 *
 * *Pozovi* and *WhatsApp* are the reason this screen exists: the number is
 * stored in E.164 precisely so both links work from a Greek network, where a
 * saved `064…` would not connect (SPEC §7).
 *
 * Both legs are shown, always — unlike the list, which shows only the main one.
 * `resolveMainLeg` deliberately has no "from today forward" horizon, so a trip
 * that has already departed and returned still renders here in full. The
 * direction chip marks which leg is currently the main one.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react";
import { BedzAutora } from "@/components/bedz-autora";
import { CipSmera } from "@/components/cip-smera";
import { DugmeBrisanja } from "@/components/dugme-brisanja";
import { Button } from "@/components/ui/button";
import { rezervacijaPoId } from "@/db/queries";
import { punoImeDestinacije } from "@/domen/destinacije";
import { resolveMainLeg } from "@/domen/glavna-etapa";
import { zahtevajKorisnika } from "@/lib/auth";
import { danasBeograd, formatDug } from "@/lib/datum";
import { putanjaNazad } from "@/lib/navigacija";
import { T, putnika } from "@/lib/tekst";
import { formatTelefon, telLink, whatsAppLink } from "@/lib/telefon";

export default async function Detalji({
  params,
  searchParams,
}: PageProps<"/rezervacija/[id]">) {
  await zahtevajKorisnika();

  const { id } = await params;
  const nazad = putanjaNazad((await searchParams).nazad);

  const red = await rezervacijaPoId(id);
  if (!red) notFound();

  const danas = danasBeograd();
  const glavna = resolveMainLeg(red, danas);
  const { rezervacija, autor } = red;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href={nazad}
          aria-label={T.nav.nazad}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{T.detalji.naslov}</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-4">
        <div className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold break-words">
              {rezervacija.ime}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {putnika(rezervacija.brojPutnika)}
            </p>
          </div>
          {glavna ? <CipSmera smer={glavna.smer} className="mt-1" /> : null}
        </div>

        {/* The two call buttons sit above the fold — this is the screen the
            owner opens while the phone is already at his ear. */}
        <div className="mb-6 flex gap-3">
          <Button asChild className="h-12 flex-1 gap-2 text-base">
            <a href={telLink(rezervacija.telefon)}>
              <PhoneIcon className="size-4" />
              {T.detalji.pozovi}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 flex-1 gap-2 text-base"
          >
            <a
              href={whatsAppLink(rezervacija.telefon)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleIcon className="size-4" />
              {T.detalji.whatsapp}
            </a>
          </Button>
        </div>

        <dl className="flex flex-col divide-y divide-border rounded-xl border border-border">
          <Red oznaka={T.forma.telefon}>
            <a
              href={telLink(rezervacija.telefon)}
              className="underline underline-offset-4"
            >
              {formatTelefon(rezervacija.telefon)}
            </a>
          </Red>

          <Red oznaka={T.detalji.polazak}>
            <span className="block">{formatDug(rezervacija.datumPolaska)}</span>
            <span className="block text-sm text-muted-foreground">
              {punoImeDestinacije(red.destinacija)}
            </span>
          </Red>

          <Red oznaka={T.detalji.povratak}>
            {rezervacija.datumPovratka ? (
              <>
                <span className="block">
                  {formatDug(rezervacija.datumPovratka)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {punoImeDestinacije(red.destinacijaPovratka)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {T.detalji.bezPovratka}
              </span>
            )}
          </Red>

          <Red oznaka={T.detalji.uneo}>
            <BedzAutora autor={autor} saImenom />
          </Red>
        </dl>
      </main>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button asChild variant="outline" className="h-12 flex-1 gap-2 text-base">
          <Link
            href={`/rezervacija/${rezervacija.id}/izmeni?nazad=${encodeURIComponent(nazad)}`}
          >
            <PencilIcon className="size-4" />
            {T.detalji.izmeni}
          </Link>
        </Button>
        <DugmeBrisanja id={rezervacija.id} nazad={nazad} />
      </div>
    </div>
  );
}

function Red({
  oznaka,
  children,
}: {
  oznaka: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {oznaka}
      </dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}
