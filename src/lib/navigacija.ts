/**
 * Where "back" goes.
 *
 * The list carries its filters in the query string, so every link off it
 * passes that path along as `?nazad=…` and every screen hands it back. Without
 * it, saving a booking would drop the owner onto an unfiltered list and lose
 * the view they were working in.
 *
 * The value arrives from a URL, which means it is user input. Only a relative
 * in-app path is honoured: `//evil.example` is a protocol-relative URL that a
 * naive `startsWith("/")` would wave straight through, which is how a back
 * link becomes an open redirect.
 */
export function putanjaNazad(
  vrednost: string | string[] | undefined,
  podrazumevano = "/",
): string {
  const v = Array.isArray(vrednost) ? vrednost[0] : vrednost;
  if (typeof v !== "string") return podrazumevano;
  if (!v.startsWith("/") || v.startsWith("//")) return podrazumevano;
  return v;
}
