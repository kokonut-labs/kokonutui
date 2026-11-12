import { getProPeek } from "@/lib/pro-peeks";

// A wider look at Kokonut UI Pro than the ten peeks spread through the docs:
// one page of stills, grouped the way Pro's own docs are. The stills come
// from `bun run stills` in the Pro repo (scaled to 1000px wide and copied into
// `public/pro-showcase/`); the peeks reuse theirs from `public/pro-peeks/`.
// No Pro code ships with this site, and nothing here runs a component.

export interface ShowcaseItem {
  /** The component's name in the Pro registry. */
  name: string;
  title: string;
  /** One line on what it does once it's live. */
  line: string;
}

export interface ShowcaseGroup {
  id: string;
  title: string;
  items: ShowcaseItem[];
}

const PRO_URL = "https://kokonutui.pro";

export const PRO_SHOWCASE_PAGE = "/docs/pro";

/**
 * How many components Pro has, rounded down: 154 in its registry on
 * 2026-11-12. Every mention of Pro on this site reads it from here.
 */
const PRO_COMPONENT_COUNT = "150+";

/** Pro in one line, for the Pro card beside the docs. */
export const PRO_TAGLINE = `${PRO_COMPONENT_COUNT} components and templates for AI products`;

/** The one-line pitch on the banner above the header and under the sidebar. */
export const PRO_PITCH = `${PRO_TAGLINE}, works with Claude Code, Cursor and more`;

/** Categories counted from Pro's docs on 2026-10-17, templates on 2026-10-23. */
export const PRO_STATS = [
  { value: PRO_COMPONENT_COUNT, label: "components" },
  { value: "20+", label: "categories" },
  { value: "6", label: "templates" },
];

export const PRO_SHOWCASE: ShowcaseGroup[] = [
  {
    id: "heroes",
    title: "Heroes",
    items: [
      {
        name: "dither-reveal-hero",
        title: "Dither Reveal Hero",
        line: "The prompt types itself in and the scene resolves from coarse dither.",
      },
      {
        name: "kinetic-type-hero",
        title: "Kinetic Type Hero",
        line: "An edge-to-edge headline whose letters lean away from the cursor.",
      },
      {
        name: "agent-flow-hero",
        title: "Agent Flow Hero",
        line: "A live node graph of a run: pulses travel the edges and steps tick their results.",
      },
      {
        name: "rhythm-hero",
        title: "Rhythm Hero",
        line: "Hairline rings breathe a 4-7-8 cycle over a week of sleep data.",
      },
      {
        name: "chart-hero",
        title: "Chart Hero",
        line: "A full-bleed area chart with a scrub crosshair and range tabs that morph the line.",
      },
      {
        name: "terminal-hero",
        title: "Terminal Hero",
        line: "A big terminal streams a deploy, then a preview card and passing checks land.",
      },
    ],
  },
  {
    id: "sections",
    title: "Sections",
    items: [
      {
        name: "security-bento",
        title: "Security Bento",
        line: "Every cell a working admin screen, and each change lands in the audit log.",
      },
      {
        name: "dashboard-feature",
        title: "Dashboard Feature",
        line: "Drag across the chart and the nearest release says what it did to the number.",
      },
      {
        name: "alternating-feature",
        title: "Alternating Feature",
        line: "An agent run trace and a fine-tuning chart, in rows that swap sides.",
      },
      {
        name: "collection-feature",
        title: "Collection Feature",
        line: "A line sheet of garment sketches that recolor with each colorway.",
      },
      {
        name: "inline-chips-headline",
        title: "Inline Chips Headline",
        line: "A headline with small pieces of product UI set inside the sentence.",
      },
      {
        name: "minimal-faq",
        title: "Minimal FAQ",
        line: "Hairline questions, one answer open at a time, each with its own link.",
      },
    ],
  },
  {
    id: "app-ui",
    title: "App UI",
    items: [
      {
        name: "kanban-board",
        title: "Kanban Board",
        line: "Drag cards between columns, or move them with Space and the arrow keys.",
      },
      {
        name: "calendar-schedule",
        title: "Calendar Schedule",
        line: "Event chips on a month, and the selected day's events beside it.",
      },
      {
        name: "slash-command-menu",
        title: "Slash Command Menu",
        line: "Type / to pick a command, and a hint bar fills in its arguments.",
      },
      {
        name: "docs-search",
        title: "Docs Search",
        line: "Hits grouped by page, and an answer that cites each source.",
      },
      {
        name: "team-invite-card",
        title: "Team Invite Card",
        line: "Paste emails, pick a role, check seats and send with Undo.",
      },
      {
        name: "canvas-toolbar",
        title: "Canvas Toolbar",
        line: "A whiteboard's tool dock with keys, sticky notes and live cursors.",
      },
    ],
  },
  {
    id: "cards",
    title: "Cards",
    items: [
      {
        name: "image-generation-card",
        title: "Image Generation Card",
        line: "The image resolves from coarse pixels to sharp, then four variations land.",
      },
      {
        name: "onboarding-checklist",
        title: "Onboarding Checklist",
        line: "The ring fills as steps are checked and the next one opens.",
      },
      {
        name: "audio-player-card",
        title: "Audio Player Card",
        line: "Scrub the waveform and chapter names show as you pass them.",
      },
      {
        name: "order-tracker",
        title: "Order Tracker",
        line: "A milestone rail that unfolds into the full scan history.",
      },
      {
        name: "poll-card",
        title: "Poll Card",
        line: "Choosing is voting: bars grow to their share and Undo stays for five seconds.",
      },
      {
        name: "job-listing-card",
        title: "Job Listing Card",
        line: "Apply without leaving the card, with the salary on a market range.",
      },
    ],
  },
  {
    id: "inputs",
    title: "Inputs",
    items: [
      {
        name: "price-range",
        title: "Price Range",
        line: "Two handles over a histogram, and the result count follows.",
      },
      {
        name: "shortcut-recorder",
        title: "Shortcut Recorder",
        line: "Hold keys to record a binding, and clashes offer to replace.",
      },
      {
        name: "natural-date-input",
        title: "Natural Date Input",
        line: "Type “next fri 3pm” and a preview rolls to the exact date.",
      },
      {
        name: "mention-input",
        title: "Mention Input",
        line: "Type @ to pick people, and see who will be notified before you send.",
      },
      {
        name: "verification-code",
        title: "Verification Code",
        line: "Fills from typing, paste or autofill, and folds into a Verified pill.",
      },
      {
        name: "swatch-fan",
        title: "Swatch Fan",
        line: "Drag the deck open like a paint fan and pick a shade.",
      },
    ],
  },
  {
    id: "forms-and-dialogs",
    title: "Forms and dialogs",
    items: [
      {
        name: "flight-search-form",
        title: "Flight Search Form",
        line: "A boarding-pass search with an animated swap and a passengers picker.",
      },
      {
        name: "booking-picker",
        title: "Booking Picker",
        line: "Drag a 30-minute window between busy blocks in the host's day.",
      },
      {
        name: "product-options-form",
        title: "Product Options Form",
        line: "A price delta on each option, a rolling total and stock hints.",
      },
      {
        name: "shortcuts-dialog",
        title: "Shortcuts Dialog",
        line: "Every shortcut in one sheet, and keys light up as you press them.",
      },
      {
        name: "settings-dialog",
        title: "Settings Dialog",
        line: "Changes wait for Save, with a count bar and a dot on edited sections.",
      },
      {
        name: "feedback-composer",
        title: "Feedback Composer",
        line: "Similar roadmap requests show up as you type, ready to upvote.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing",
    items: [
      {
        name: "ticket-pricing",
        title: "Ticket Pricing",
        line: "Three plans as printed passes with rolling prices and a barcode stub.",
      },
      {
        name: "layer-stack-pricing",
        title: "Layer Stack Pricing",
        line: "Pick a plan and an isometric stack builds up to it.",
      },
      {
        name: "credit-pack-pricing",
        title: "Credit Pack Pricing",
        line: "Prepaid credit packs with the price per credit and auto top-up.",
      },
      {
        name: "pay-button",
        title: "Pay Button",
        line: "Digits roll as seats change, then Processing and Paid.",
      },
    ],
  },
  {
    id: "pages",
    title: "Pages",
    items: [
      {
        name: "projects-dashboard",
        title: "Projects Dashboard",
        line: "Project covers, live search and a grid that morphs into a list.",
      },
      {
        name: "billing-usage",
        title: "Billing and Usage",
        line: "Plan, projected usage meters, prorated changes and invoices.",
      },
      {
        name: "team-calendar-page",
        title: "Team Calendar",
        line: "A team's week with drag to create, a second time zone and RSVPs.",
      },
      {
        name: "storefront-page",
        title: "Storefront",
        line: "Garments that recolour live, quick add and a bag drawer.",
      },
    ],
  },
];

export const PRO_SHOWCASE_COUNT = PRO_SHOWCASE.reduce(
  (sum, group) => sum + group.items.length,
  0
);

export const getShowcaseGroup = (id: string) =>
  PRO_SHOWCASE.find((group) => group.id === id);

/** Peeks already have their stills in the docs, so those are reused. */
export const showcaseStill = (name: string, theme: "light" | "dark") =>
  getProPeek(name)
    ? `/pro-peeks/${name}-${theme}.webp`
    : `/pro-showcase/${name}-${theme}.webp`;

/** Every way out to Pro lands on its homepage, tagged with where it came from. */
export const showcaseUrl = (item: ShowcaseItem, medium = "docs-showcase") =>
  `${PRO_URL}/?utm_source=kokonutui.com&utm_medium=${medium}&utm_content=${item.name}`;

export const PRO_SHOWCASE_LANDING_URL = `${PRO_URL}/?utm_source=kokonutui.com&utm_medium=docs-showcase`;
