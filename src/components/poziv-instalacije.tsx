"use client";

/**
 * The Add-to-Home-Screen card, on Podešavanja.
 *
 * It lives here rather than on the list on purpose. The list is the screen
 * the owner opens twenty times a day while working; a banner there is a
 * banner he learns to swipe past. Podešavanja is where someone goes when they
 * are setting the app up, which is the one moment installing it is what they
 * actually want.
 *
 * Two platforms, two different things to offer:
 *
 * - **Android/Chrome** fires `beforeinstallprompt`, which can be held and
 *   replayed from a button of our own. Holding it also suppresses Chrome's
 *   own mini-infobar, which is the point — one invitation, in Serbian, in
 *   the place it belongs.
 * - **iOS/Safari** has no such event and no API to open the sheet. All that
 *   can be done is to say where the button is. So the iPhone branch is an
 *   instruction, not a button that lies about what it will do.
 *
 * The card hides itself once the app is already running standalone, and stays
 * hidden once dismissed. Dismissal is `localStorage` because it is a
 * per-device preference about a per-device act: the same account on the
 * second phone still needs to be asked.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { ShareIcon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/tekst";

/** Chrome's event. Not in lib.dom, because it is not standardised. */
type DogadjajInstalacije = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KLJUC = "kombi:instalacija-odbijena";

const KLASE_KARTICE = "flex flex-col gap-3 rounded-xl border border-border p-4";

function jeStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, older flag — the standards one is false on iOS.
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function jeIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function odbijenoRanije(): boolean {
  try {
    return localStorage.getItem(KLJUC) === "1";
  } catch {
    // Private mode throws rather than returning null. Show the card.
    return false;
  }
}

type Uredjaj = "skriveno" | "ios" | "drugi";

/** Nothing to subscribe to: none of these facts change while the page lives. */
const BEZ_PRETPLATE = () => () => {};

function ocitajUredjaj(): Uredjaj {
  if (jeStandalone() || odbijenoRanije()) return "skriveno";
  return jeIos() ? "ios" : "drugi";
}

/**
 * What kind of device this is, read during render rather than in an effect.
 *
 * `navigator` and `matchMedia` do not exist on the server, so the value has
 * to come from somewhere that knows the difference. `useSyncExternalStore`
 * with a server snapshot of `"skriveno"` gives exactly that, and — unlike an
 * effect — never renders one frame of a card it is about to take away.
 */
function useUredjaj(): Uredjaj {
  return useSyncExternalStore(BEZ_PRETPLATE, ocitajUredjaj, () => "skriveno");
}

export function PozivInstalacije() {
  const uredjaj = useUredjaj();
  const [odbaceno, postaviOdbaceno] = useState(false);
  const [dogadjaj, postaviDogadjaj] = useState<DogadjajInstalacije | null>(null);

  useEffect(() => {
    if (uredjaj !== "drugi") return;

    function uhvati(e: Event) {
      // Holding the event is what suppresses Chrome's own infobar. It can be
      // replayed exactly once, which is why it is kept rather than copied.
      e.preventDefault();
      postaviDogadjaj(e as DogadjajInstalacije);
    }

    window.addEventListener("beforeinstallprompt", uhvati);
    return () => window.removeEventListener("beforeinstallprompt", uhvati);
  }, [uredjaj]);

  function sakrij() {
    try {
      localStorage.setItem(KLJUC, "1");
    } catch {
      // Nothing to do — the card comes back next time, which is survivable.
    }
    postaviOdbaceno(true);
  }

  async function instaliraj(spreman: DogadjajInstalacije) {
    await spreman.prompt();
    // Either way the event is spent, so the card goes. Accepted means it is
    // installed; dismissed means he has been asked and said no.
    await spreman.userChoice;
    sakrij();
  }

  if (odbaceno || uredjaj === "skriveno") return null;
  // On Chrome the card waits for the browser to say the app is installable at
  // all. Showing an install button the browser would refuse to honour is
  // worse than showing nothing.
  if (uredjaj === "drugi" && dogadjaj === null) return null;

  return (
    <section className={KLASE_KARTICE}>
      <div className="flex items-start gap-3">
        <SmartphoneIcon
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">{T.instalacija.naslov}</h2>
          <p className="text-sm text-muted-foreground">{T.instalacija.opis}</p>
        </div>
      </div>

      {uredjaj === "ios" ? (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <ShareIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{T.instalacija.uputstvoIos}</span>
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={sakrij}
          className="h-11 flex-1 text-base"
        >
          {T.instalacija.odbaci}
        </Button>
        {dogadjaj !== null ? (
          <Button
            type="button"
            onClick={() => instaliraj(dogadjaj)}
            className="h-11 flex-1 text-base"
          >
            {T.instalacija.dugme}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
