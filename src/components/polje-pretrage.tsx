"use client";

/**
 * The search box in the sticky header — SPEC §3.
 *
 * Typing is local and immediate; the URL follows on a short debounce. Without
 * the debounce every keystroke would be a navigation and a server render, and
 * on a phone on a Greek network that is a visibly laggy input.
 *
 * It navigates with `router.replace`, not `push`: eight keystrokes must not
 * become eight back-button steps. The filter sheet uses `push`, because
 * applying a filter *is* a step worth going back over.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { T } from "@/lib/tekst";
import { putanjaListe, type StanjeUrl } from "@/lib/url-stanje";

const ODLAGANJE_MS = 250;

export function PoljePretrage({ stanje }: { stanje: StanjeUrl }) {
  const router = useRouter();
  const [tekst, postaviTekst] = useState(stanje.pretraga);
  // What the URL said at the last render. Adjusting state during render, not
  // in an effect: the box must follow the URL when the user navigates back to
  // a differently-searched list, and an effect would show the stale text for a
  // frame first.
  const [izUrl, postaviIzUrl] = useState(stanje.pretraga);
  if (izUrl !== stanje.pretraga) {
    postaviIzUrl(stanje.pretraga);
    postaviTekst(stanje.pretraga);
  }

  useEffect(() => {
    // Once the navigation lands, the URL matches what was typed and this is a
    // no-op — which is what stops the debounce from feeding itself.
    if (tekst.trim() === stanje.pretraga.trim()) return;
    const id = setTimeout(() => {
      router.replace(putanjaListe({ ...stanje, pretraga: tekst }));
    }, ODLAGANJE_MS);
    return () => clearTimeout(id);
  }, [tekst, stanje, router]);

  return (
    <div className="relative flex-1">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        inputMode="search"
        // `search` gets a native clear affordance on some platforms and none on
        // others, so the X below is ours and always there.
        value={tekst}
        onChange={(e) => postaviTekst(e.target.value)}
        placeholder={T.lista.pretraga}
        aria-label={T.lista.pretraga}
        className="h-11 pr-11 pl-9 text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
      />
      {tekst !== "" ? (
        <button
          type="button"
          onClick={() => postaviTekst("")}
          aria-label={T.lista.obrisiPretragu}
          className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
