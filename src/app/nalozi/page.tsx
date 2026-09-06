/**
 * Nalozi — teams and accounts, for the owners.
 *
 * `zahtevajAdmina()` is the first line and `notFound()`s a driver, so this
 * route is indistinguishable from a typo unless you are an owner. The link to
 * it on `/podesavanja` is rendered on the same condition.
 *
 * There is no delete button, and its absence is explained on the screen rather
 * than left to be discovered: `reservations.kreirao -> profiles.id` is
 * `ON DELETE RESTRICT`, so an account that has entered a booking cannot be
 * removed from either end. Taking access away is what `aktivan` is for.
 */
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { FormaNaloga, FormaTima, PrekidacPristupa } from "@/components/forma-naloga";
import { sviProfiliZaAdmina, sviTimoviZaAdmina } from "@/db/queries";
import { jeAdmin } from "@/domen/pristup";
import { zahtevajAdmina } from "@/lib/auth";
import { T } from "@/lib/tekst";
import { uporediTekst } from "@/lib/tekst";

export default async function Nalozi() {
  const admin = await zahtevajAdmina();

  const [profili, timovi] = await Promise.all([
    sviProfiliZaAdmina(),
    sviTimoviZaAdmina(),
  ]);

  const administratori = profili
    .filter(jeAdmin)
    .sort((a, b) => uporediTekst(a.ime, b.ime));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href="/podesavanja"
          aria-label={T.nav.nazad}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{T.timovi.naslov}</h1>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {T.timovi.timovi}
          </h2>
          {timovi.map((tim) => {
            const clanovi = profili
              .filter((p) => p.timId === tim.id)
              .sort((a, b) => uporediTekst(a.ime, b.ime));
            return (
              <div
                key={tim.id}
                className="rounded-xl border border-border px-4 py-3"
              >
                <p className="font-medium">{tim.naziv}</p>
                {clanovi.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {T.timovi.nemaNaloga}
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {clanovi.map((p) => (
                      <li key={p.id} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: p.boja }}
                          className="size-6 shrink-0 rounded-full"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {p.ime}
                          {p.aktivan ? null : (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {T.timovi.neaktivan}
                            </span>
                          )}
                        </span>
                        <PrekidacPristupa
                          id={p.id}
                          aktivan={p.aktivan}
                          sam={p.id === admin.id}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <FormaTima />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {T.timovi.administrator}
          </h2>
          <ul className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
            {administratori.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: p.boja }}
                  className="size-6 shrink-0 rounded-full"
                />
                <span className="min-w-0 flex-1 truncate">{p.ime}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {T.timovi.noviNalog}
          </h2>
          {timovi.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {T.timovi.nemaTimova}
            </p>
          ) : (
            <FormaNaloga timovi={timovi} />
          )}
          <p className="text-sm text-muted-foreground">
            {T.timovi.zastoNemaBrisanja}
          </p>
        </section>
      </main>
    </div>
  );
}
