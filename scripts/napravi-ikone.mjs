/**
 * Generates the home screen icons into `public/ikone/`.
 *
 * The PNGs are committed — this script is here so they can be regenerated
 * rather than redrawn, not so the build depends on it. It uses `sharp`, which
 * arrives with Next and is not a declared dependency of this project; that is
 * fine for a tool run by hand and would not be for anything in `next build`.
 *
 * The mark is the app's own two direction chips: the sky arrow of an Odlazak
 * over the amber arrow of a Povratak, on the near-black of a departure board.
 * Nothing else in the icon means anything, which is the intent — at 48px on a
 * home screen, two arrows in two colours is the most information that
 * survives.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IZLAZ = path.join(KOREN, "public", "ikone");

const POZADINA = "#16181d";
const ODLAZAK = "#38bdf8"; // sky-400, the Odlazak chip
const POVRATAK = "#fbbf24"; // amber-400, the Povratak chip

/** An arrow pointing up, filling the box (x, y, w, h). */
function strelicaGore(x, y, w, h) {
  const cx = x + w / 2;
  const stablo = w * 0.4;
  const glava = h * 0.5;
  return [
    `M ${cx} ${y}`,
    `L ${x + w} ${y + glava}`,
    `L ${cx + stablo / 2} ${y + glava}`,
    `L ${cx + stablo / 2} ${y + h}`,
    `L ${cx - stablo / 2} ${y + h}`,
    `L ${cx - stablo / 2} ${y + glava}`,
    `L ${x} ${y + glava}`,
    "Z",
  ].join(" ");
}

/** The same arrow, pointing down. */
function strelicaDole(x, y, w, h) {
  const cx = x + w / 2;
  const stablo = w * 0.4;
  const glava = h * 0.5;
  return [
    `M ${cx} ${y + h}`,
    `L ${x} ${y + glava}`,
    `L ${cx - stablo / 2} ${y + glava}`,
    `L ${cx - stablo / 2} ${y}`,
    `L ${cx + stablo / 2} ${y}`,
    `L ${cx + stablo / 2} ${y + glava}`,
    `L ${x + w} ${y + glava}`,
    "Z",
  ].join(" ");
}

/**
 * @param udeo how much of the square the mark may occupy. A maskable icon is
 *   cropped to a circle by the launcher, so its mark has to fit inside the
 *   80%-diameter safe zone; a plain icon can be bolder.
 */
function svg(strana, udeo) {
  const mark = strana * udeo;
  const x0 = (strana - mark) / 2;
  const y0 = (strana - mark) / 2;
  const razmak = mark * 0.12;
  const sirina = (mark - razmak) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${strana}" height="${strana}" viewBox="0 0 ${strana} ${strana}">
  <rect width="${strana}" height="${strana}" fill="${POZADINA}"/>
  <path d="${strelicaGore(x0, y0, sirina, mark)}" fill="${ODLAZAK}"/>
  <path d="${strelicaDole(x0 + sirina + razmak, y0, sirina, mark)}" fill="${POVRATAK}"/>
</svg>`;
}

const IKONE = [
  { ime: "ikona-192.png", strana: 192, udeo: 0.68 },
  { ime: "ikona-512.png", strana: 512, udeo: 0.68 },
  // The launcher crops this one to a circle, so the mark is pulled well
  // inside the 80% safe zone and the background bleeds to the edges.
  { ime: "ikona-512-maskable.png", strana: 512, udeo: 0.52 },
  // iOS applies its own rounding and never a circle, so this one is full.
  { ime: "apple-touch-icon.png", strana: 180, udeo: 0.68 },
];

await mkdir(IZLAZ, { recursive: true });

for (const { ime, strana, udeo } of IKONE) {
  const png = await sharp(Buffer.from(svg(strana, udeo))).png().toBuffer();
  await writeFile(path.join(IZLAZ, ime), png);
  console.log(`${ime.padEnd(28)} ${strana}×${strana}  ${png.length} B`);
}

console.log(`\nIkone su u ${path.relative(KOREN, IZLAZ)}.`);
