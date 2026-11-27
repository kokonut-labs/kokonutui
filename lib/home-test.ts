// The homepage test: desktop visitors are split between the current
// homepage and the canvas, both at /. proxy.ts deals the version and keeps
// it in a cookie for 30 days; analytics events carry it as a flag.

export const HOME_TEST_COOKIE = "home-test";

/** Who sees the canvas: this share of new desktop visitors. 0 ends the test. */
export const CANVAS_SHARE = 0.5;

export const HOME_VERSIONS = ["current", "canvas"] as const;
export type HomeVersion = (typeof HOME_VERSIONS)[number];

const READ = new RegExp(`(?:^|; )${HOME_TEST_COOKIE}=(current|canvas)(?:;|$)`);

/** In the browser: the version this visitor is shown, when they're in the test. */
export function homeVersion(): HomeVersion | undefined {
  if (typeof document === "undefined") {
    return;
  }
  return READ.exec(document.cookie)?.[1] as HomeVersion | undefined;
}
