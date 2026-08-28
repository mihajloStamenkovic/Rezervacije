/**
 * Runs the test suite once per timezone and fails if any run differs.
 *
 * The app's single most dangerous failure mode is a date that depends on where
 * the phone is standing. A suite that only ever runs in one timezone cannot
 * catch it, so this runs the same tests in four — including one either side of
 * the international date line.
 *
 * Node reads TZ at startup, so each timezone needs its own process.
 */
import { spawnSync } from "node:child_process";

const ZONE = [
  "UTC",
  "Europe/Belgrade",
  "Europe/Athens",
  "Pacific/Auckland",
  "America/Los_Angeles",
];

let neuspelo = 0;

for (const TZ of ZONE) {
  process.stdout.write(`\n─── TZ=${TZ} ${"─".repeat(Math.max(0, 50 - TZ.length))}\n`);
  const rezultat = spawnSync("npx", ["vitest", "run", "--reporter=dot"], {
    env: { ...process.env, TZ },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (rezultat.status !== 0) {
    neuspelo += 1;
    console.error(`FAIL: testovi ne prolaze pod TZ=${TZ}`);
  }
}

if (neuspelo > 0) {
  console.error(`\n${neuspelo} od ${ZONE.length} vremenskih zona nije prošlo.`);
  process.exit(1);
}
console.log(`\nSvih ${ZONE.length} vremenskih zona daje isti rezultat.`);
