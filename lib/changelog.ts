/**
 * The library's changelog, newest release first. Components are named by
 * their registry name; titles, codes and descriptions come from the docs, so
 * an entry is just the name, the pull request and, for changes, one line on
 * what changed.
 *
 * Adding a component: add its name to `added` on today's release (or start
 * a new release at the top), and a matching `## Month D, YYYY` heading with
 * `<Release date="…" />` in content/docs/changelog.mdx.
 */

export interface ChangelogEntry {
  name: string;
  pr: number;
  /** What changed, for improved components. Plain words, no marketing. */
  note?: string;
}

export interface Release {
  /** ISO date, YYYY-MM-DD: the day the pull requests merged. */
  date: string;
  added: ChangelogEntry[];
  improved: ChangelogEntry[];
  /** Changes that touch the whole library rather than one component. */
  library?: { note: string; prs: number[] }[];
}

/**
 * A component counts as new if it shipped within this many days of the latest
 * release. Measured from the changelog, not the clock, so pages stay static
 * and the tags only move when a release is added.
 */
export const NEW_FOR_DAYS = 30;

export const RELEASES: Release[] = [
  {
    date: "2026-10-14",
    added: [
      { name: "notification-stack", pr: 39 },
      { name: "detent-dial", pr: 40 },
      { name: "wheel-picker", pr: 41 },
      { name: "topo-background", pr: 46 },
      { name: "pull-cord", pr: 47 },
      { name: "liquid-gauge", pr: 50 },
      { name: "activity-terrain", pr: 51 },
      { name: "receipt-printer", pr: 52 },
      { name: "liquid-slider", pr: 53 },
      { name: "signature-pad", pr: 54 },
      { name: "tear-button", pr: 55 },
      { name: "bell-button", pr: 56 },
      { name: "plucked-text", pr: 57 },
      { name: "marking-menu", pr: 58 },
      { name: "drape-background", pr: 59 },
    ],
    improved: [
      {
        name: "background-paths",
        pr: 48,
        note: "Rebuilt as one flowing ribbon of lines that part around the cursor.",
      },
      {
        name: "shape-hero",
        pr: 49,
        note: "Rebuilt around a pile of shapes you can drag and throw.",
      },
      {
        name: "ai-voice",
        pr: 60,
        note: "A scrolling waveform, and a take you review before sending.",
      },
      {
        name: "ai-prompt",
        pr: 61,
        note: "Attachment chips, slash commands, and Stop while it replies.",
      },
      {
        name: "ai-loading",
        pr: 62,
        note: "Agent steps with a live log, a step rail and timings.",
      },
      {
        name: "ai-text-loading",
        pr: 63,
        note: "A letter wave instead of a gradient shimmer.",
      },
      {
        name: "particle-button",
        pr: 25,
        note: "Calls your onClick and onSuccess, and keeps particles inside the button.",
      },
      {
        name: "glitch-text",
        pr: 26,
        note: "Burst-style glitch, gradient text that renders everywhere, reduced motion.",
      },
      {
        name: "gradient-button",
        pr: 27,
        note: "Correct light and dark themes, and renders its children and icon.",
      },
      {
        name: "currency-transfer",
        pr: 28,
        note: "Typed props, a controlled status, and screen reader support.",
      },
      {
        name: "bento-grid",
        pr: 29,
        note: "Takes its tiles as an items prop, with fixed column spans.",
      },
    ],
    library: [
      {
        note: "Every component now works right after shadcn add, without the docs site's styles.",
        prs: [32],
      },
      {
        note: "Fixed components whose main feature didn't work.",
        prs: [33],
      },
      {
        note: "Keyboard, focus and screen reader fixes, and reduced motion support, across the library.",
        prs: [34, 35, 36],
      },
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "October 14, 2026", the release heading. */
export function formatReleaseDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The heading's anchor on the changelog page, e.g. "october-14-2026". */
export function releaseAnchor(date: string) {
  return formatReleaseDate(date)
    .toLowerCase()
    .replace(",", "")
    .replace(/ /g, "-");
}

export const CHANGELOG_URL = "/docs/changelog";

/** The release date for each component, keyed by registry name. */
export function getAddedDates(): Map<string, string> {
  const added = new Map<string, string>();
  for (const release of RELEASES) {
    for (const entry of release.added) {
      added.set(entry.name, release.date);
    }
  }
  return added;
}

const time = (date: string) => new Date(`${date}T00:00:00Z`).getTime();

/** Whether a release is recent enough for its components to read as new. */
export function isRecent(date: string) {
  const latest = RELEASES[0]?.date ?? date;
  return time(latest) - time(date) < NEW_FOR_DAYS * DAY_MS;
}
