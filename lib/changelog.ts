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
    date: "2026-10-21",
    added: [
      { name: "timezone-planner", pr: 113 },
      { name: "page-flip", pr: 113 },
      { name: "invite-envelope", pr: 113 },
      { name: "bookshelf", pr: 113 },
      { name: "pull-to-refresh", pr: 113 },
      { name: "ai-token-alternatives", pr: 113 },
    ],
    improved: [],
  },
  {
    date: "2026-10-19",
    added: [],
    improved: [
      {
        name: "ai-input-search",
        pr: 110,
        note: "Tools menu with a tool header, model picker, Ask key and source avatars.",
      },
    ],
  },
  {
    date: "2026-10-17",
    added: [],
    improved: [
      {
        name: "metric-card",
        pr: 109,
        note: "Drag a range, isolate a segment from the breakdown, and pinned events that name themselves.",
      },
    ],
    library: [
      {
        note: "Color and instrument details across 9 components, and zinc grays instead of blue-tinted ones in 10 more.",
        prs: [100, 101],
      },
    ],
  },
  {
    date: "2026-10-16",
    added: [
      { name: "spoiler-text", pr: 89 },
      { name: "stack-panel", pr: 89 },
      { name: "ai-autocomplete", pr: 89 },
      { name: "undo-button", pr: 91 },
      { name: "clip-trimmer", pr: 92 },
      { name: "synced-transcript", pr: 92 },
      { name: "focal-point-picker", pr: 92 },
      { name: "photo-straighten", pr: 92 },
    ],
    improved: [
      {
        name: "ai-prompt",
        pr: 85,
        note: "Reworked composer whose model menu defaults to the current Claude models.",
      },
      {
        name: "currency-transfer",
        pr: 85,
        note: "Redesigned, with a motion pass on the transfer.",
      },
      {
        name: "file-upload",
        pr: 90,
        note: "A multi-file queue with per-file progress, retry and cancel.",
      },
      {
        name: "switch-button",
        pr: 90,
        note: "The new theme spreads from the button as a circle; the sun folds into a moon.",
      },
      {
        name: "particle-button",
        pr: 90,
        note: "Now a status button for async actions: spinner, drawn check and a burst, or an error.",
      },
      {
        name: "hold-button",
        pr: 90,
        note: "Shorter hold, a fill that drains back on early release, and a solid finish.",
      },
      {
        name: "command-button",
        pr: 90,
        note: "Keycaps that sink as you press the real shortcut, which now works page-wide.",
      },
      {
        name: "attract-button",
        pr: 93,
        note: "A field of iron filings that traces the button, turns toward the cursor and pulls in on hover.",
      },
      {
        name: "team-selector",
        pr: 93,
        note: "Drag the number to scrub, local avatars, up to 12 seats with a +N chip, optional seat price.",
      },
      {
        name: "smooth-drawer",
        pr: 93,
        note: "An order summary sheet on Vaul snap points: peek at the total, drag up for details.",
      },
    ],
  },
  {
    date: "2026-10-15",
    added: [
      { name: "cradle-text", pr: 69 },
      { name: "scroll-index", pr: 70 },
      { name: "halftone-background", pr: 71 },
      { name: "metric-card", pr: 72 },
      { name: "uptime-card", pr: 73 },
      { name: "spending-ring", pr: 74 },
      { name: "ai-tool-approval", pr: 76 },
      { name: "ai-context-meter", pr: 77 },
      { name: "ai-citations", pr: 78 },
      { name: "ai-diff-review", pr: 79 },
      { name: "ai-model-selector", pr: 80 },
      { name: "status-island", pr: 84 },
      { name: "morph-popover", pr: 84 },
      { name: "lightbox-grid", pr: 84 },
    ],
    improved: [
      {
        name: "apple-activity-card",
        pr: 82,
        note: "Vivid ring colors in light mode.",
      },
    ],
  },
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
      { name: "dot-field", pr: 67 },
    ],
    improved: [
      {
        name: "card-flip",
        pr: 67,
        note: "Rebuilt as Flick Card: drag or flick it to spin, with thickness and light that follow the angle.",
      },
      {
        name: "card-stack",
        pr: 67,
        note: "Rebuilt as Throw Deck: throw the top card off and it tucks back under the pile.",
      },
      {
        name: "carousel-cards",
        pr: 67,
        note: "Rebuilt as Momentum Rail: drag with momentum and cover-flow depth from scroll.",
      },
      {
        name: "liquid-glass-card",
        pr: 67,
        note: "Rebuilt as Now Playing: a spinning disc you turn to scrub the track.",
      },
      {
        name: "bento-grid",
        pr: 67,
        note: "Rebuilt as Widget Grid: pick up, reorder and resize widgets by pointer or keyboard.",
      },
      {
        name: "dynamic-text",
        pr: 67,
        note: "Rebuilt as Morph Text: letters travel, fall and land between strings, with decode and cycle modes.",
      },
      {
        name: "glitch-text",
        pr: 67,
        note: "Rebuilt as Signal Text: flat text with sliced band glitches, on idle, hover or change.",
      },
      {
        name: "swoosh-text",
        pr: 67,
        note: "Rebuilt as Extruded Text: 3D letters lit by the cursor that sink like keycaps.",
      },
      {
        name: "flow-field",
        pr: 67,
        note: "Rebuilt as Wind: monochrome streamlines that part around the cursor and swirl in its wake.",
      },
      {
        name: "toolbar",
        pr: 67,
        note: "Rebuilt as Tool Dock: a draggable editor dock with tooltips, shortcuts and tool flyouts.",
      },
      {
        name: "smooth-tab",
        pr: 67,
        note: "Rebuilt as Swipe Tabs: swipe the panel and the indicator follows your finger.",
      },
      {
        name: "morphic-navbar",
        pr: 67,
        note: "Rebuilt as Split Nav: the bar splits around the active link and you can scrub across it.",
      },
      {
        name: "profile-dropdown",
        pr: 67,
        note: "Rebuilt as Account Menu: the card morphs into its menu, with account switching and hold to sign out.",
      },
      {
        name: "action-search-bar",
        pr: 67,
        note: "Rebuilt as Command Palette: nested pages, fuzzy matching and instant keyboard use.",
      },
      {
        name: "avatar-picker",
        pr: 67,
        note: "Faces generated from your name, on a 3D coin you can flick or shuffle.",
      },
      {
        name: "currency-transfer",
        pr: 67,
        note: "Odometer amounts, a chip that carries the money across, and a progress arc.",
      },
      {
        name: "type-writer",
        pr: 67,
        note: "A caret that blinks only when idle, select-to-delete, and optional typos.",
      },
      {
        name: "apple-activity-card",
        pr: 67,
        note: "Numbers count up with the rings, and rings can go past 100%.",
      },
      {
        name: "notification-stack",
        pr: 67,
        note: "Released cards spring back or fly away with your finger's speed.",
      },
      {
        name: "topo-background",
        pr: 67,
        note: "Elevation labels on the contour lines.",
      },
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
        name: "gradient-button",
        pr: 27,
        note: "Correct light and dark themes, and renders its children and icon.",
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

/**
 * The latest recent release that reworked each component, by registry name.
 * Library notes don't count, and New wins: a component still new isn't listed.
 */
export function getUpdatedDates(): Map<string, string> {
  const added = getAddedDates();
  const updated = new Map<string, string>();
  // Newest release first, so the first date seen for a name is its latest.
  for (const release of RELEASES) {
    if (!isRecent(release.date)) {
      continue;
    }
    for (const entry of release.improved) {
      const shipped = added.get(entry.name);
      const isNew = shipped ? isRecent(shipped) : false;
      if (!(isNew || updated.has(entry.name))) {
        updated.set(entry.name, release.date);
      }
    }
  }
  return updated;
}
