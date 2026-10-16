/**
 * Screenshots the link-preview frames drawn at /og-lab, so a preview image is
 * the real components at rest rather than a picture of them.
 *
 *   bun dev                          # in another terminal
 *   bun run og                       # every frame, into .og-out/
 *   bun run og cover/light doc/tear-button/dark   # only these
 *
 * Uses your installed Chrome, or the browser at OG_BROWSER. OG_URL points it
 * at another server.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.OG_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), ".og-out");
/** Long enough for entrance motion (rings filling, counters) to settle. */
const SETTLE_MS = 3000;

const ALL = [
  ...["cover", "plates", "index"].flatMap((frame) => [
    `${frame}/light`,
    `${frame}/dark`,
  ]),
  ...["apple-activity-card", "detent-dial", "ai-prompt", "tear-button"].flatMap(
    (name) => [`doc/${name}/light`, `doc/${name}/dark`]
  ),
];

const frames = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.OG_BROWSER
    ? { executablePath: process.env.OG_BROWSER }
    : { channel: "chrome" }
);

for (const frame of frames) {
  const theme = frame.endsWith("/dark") ? "dark" : "light";
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    colorScheme: theme,
    deviceScaleFactor: 1,
  });
  await page.goto(`${BASE}/og-lab/${frame}`, { waitUntil: "networkidle" });
  // The dev tools badge sits over the frame's corner.
  await page.addStyleTag({ content: "nextjs-portal{display:none}" });
  await page.waitForTimeout(SETTLE_MS);
  const file = path.join(OUT, `${frame.replaceAll("/", "-")}.png`);
  await page.locator("[data-og-frame]").screenshot({ path: file });
  await page.close();
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}

await browser.close();
