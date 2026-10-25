/**
 * Draws the homepage's link preview: a screenshot of the cover frame at
 * /og-lab/cover/light, so the image is the real components at rest rather
 * than a picture of them. Docs pages draw their own (app/docs-og).
 *
 *   bun dev        # in another terminal
 *   bun run og     # writes app/opengraph-image.png and app/twitter-image.png
 *
 * Re-run it when the cover's copy, featured part or component count changes.
 * OG_PATH draws another frame instead, such as a direction from
 * /og-lab/proposals: OG_PATH=/og-lab/proposals/index/light bun run og
 * Uses your installed Chrome, or the browser at OG_BROWSER. OG_URL points it
 * at another server.
 */
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.OG_URL ?? "http://localhost:3000";
const FRAME = process.env.OG_PATH ?? "/og-lab/cover/light";
const OG = path.join(process.cwd(), "app/opengraph-image.png");
const TWITTER = path.join(process.cwd(), "app/twitter-image.png");
/** Long enough for the activity rings to finish filling. */
const SETTLE_MS = 3000;

const browser = await chromium.launch(
  process.env.OG_BROWSER
    ? { executablePath: process.env.OG_BROWSER }
    : { channel: "chrome" }
);
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  colorScheme: "light",
  deviceScaleFactor: 1,
});
await page.goto(`${BASE}${FRAME}`, { waitUntil: "networkidle" });
// The dev tools badge sits over the frame's corner.
await page.addStyleTag({ content: "nextjs-portal{display:none}" });
await page.waitForTimeout(SETTLE_MS);
await page.locator("[data-og-frame]").screenshot({ path: OG });
await browser.close();
await copyFile(OG, TWITTER);

for (const file of [OG, TWITTER]) {
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}
