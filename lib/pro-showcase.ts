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
  /** The Pro docs page and heading that hold the live component. */
  proPage: string;
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

/** Counted from Pro's docs on 2026-10-17; round down as it grows. */
export const PRO_STATS = [
  { value: "120+", label: "components" },
  { value: "20+", label: "categories" },
  { value: "5", label: "templates" },
];

export const PRO_SHOWCASE: ShowcaseGroup[] = [
  {
    id: "heroes",
    title: "Heroes",
    items: [
      {
        name: "dither-reveal-hero",
        title: "Dither Reveal Hero",
        proPage: "/docs/components/heroes#dither-reveal-hero",
        line: "The prompt types itself in and the scene resolves from coarse dither.",
      },
      {
        name: "kinetic-type-hero",
        title: "Kinetic Type Hero",
        proPage: "/docs/components/heroes#kinetic-type-hero",
        line: "An edge-to-edge headline whose letters lean away from the cursor.",
      },
      {
        name: "agent-flow-hero",
        title: "Agent Flow Hero",
        proPage: "/docs/components/heroes#agent-flow-hero",
        line: "A live node graph of a run: pulses travel the edges and steps tick their results.",
      },
      {
        name: "rhythm-hero",
        title: "Rhythm Hero",
        proPage: "/docs/components/heroes#rhythm-hero",
        line: "Hairline rings breathe a 4-7-8 cycle over a week of sleep data.",
      },
      {
        name: "chart-hero",
        title: "Chart Hero",
        proPage: "/docs/components/heroes#chart-hero",
        line: "A full-bleed area chart with a scrub crosshair and range tabs that morph the line.",
      },
      {
        name: "terminal-hero",
        title: "Terminal Hero",
        proPage: "/docs/components/heroes#terminal-hero",
        line: "A big terminal streams a deploy, then a preview card and passing checks land.",
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
        proPage: "/docs/components/kanban-board",
        line: "Drag cards between columns, or move them with Space and the arrow keys.",
      },
      {
        name: "calendar-schedule",
        title: "Calendar Schedule",
        proPage: "/docs/components/calendar-schedule",
        line: "Event chips on a month, and the selected day's events beside it.",
      },
      {
        name: "slash-command-menu",
        title: "Slash Command Menu",
        proPage: "/docs/components/action-search-bar#slash-command-menu",
        line: "Type / to pick a command, and a hint bar fills in its arguments.",
      },
      {
        name: "docs-search",
        title: "Docs Search",
        proPage: "/docs/components/action-search-bar#docs-search",
        line: "Hits grouped by page, and an answer that cites each source.",
      },
      {
        name: "team-invite-card",
        title: "Team Invite Card",
        proPage: "/docs/components/team-invite-card",
        line: "Paste emails, pick a role, check seats and send with Undo.",
      },
      {
        name: "canvas-toolbar",
        title: "Canvas Toolbar",
        proPage: "/docs/components/toolbar#canvas-toolbar",
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
        proPage: "/docs/components/card#image-generation-card",
        line: "The image resolves from coarse pixels to sharp, then four variations land.",
      },
      {
        name: "onboarding-checklist",
        title: "Onboarding Checklist",
        proPage: "/docs/components/card#onboarding-checklist",
        line: "The ring fills as steps are checked and the next one opens.",
      },
      {
        name: "audio-player-card",
        title: "Audio Player Card",
        proPage: "/docs/components/card#audio-player-card",
        line: "Scrub the waveform and chapter names show as you pass them.",
      },
      {
        name: "order-tracker",
        title: "Order Tracker",
        proPage: "/docs/components/card#order-tracker",
        line: "A milestone rail that unfolds into the full scan history.",
      },
      {
        name: "poll-card",
        title: "Poll Card",
        proPage: "/docs/components/card#poll-card",
        line: "Choosing is voting: bars grow to their share and Undo stays for five seconds.",
      },
      {
        name: "job-listing-card",
        title: "Job Listing Card",
        proPage: "/docs/components/card#job-listing-card",
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
        proPage: "/docs/components/input#price-range",
        line: "Two handles over a histogram, and the result count follows.",
      },
      {
        name: "shortcut-recorder",
        title: "Shortcut Recorder",
        proPage: "/docs/components/input#shortcut-recorder",
        line: "Hold keys to record a binding, and clashes offer to replace.",
      },
      {
        name: "natural-date-input",
        title: "Natural Date Input",
        proPage: "/docs/components/input#natural-date-input",
        line: "Type “next fri 3pm” and a preview rolls to the exact date.",
      },
      {
        name: "mention-input",
        title: "Mention Input",
        proPage: "/docs/components/input#mention-input",
        line: "Type @ to pick people, and see who will be notified before you send.",
      },
      {
        name: "verification-code",
        title: "Verification Code",
        proPage: "/docs/components/input#verification-code",
        line: "Fills from typing, paste or autofill, and folds into a Verified pill.",
      },
      {
        name: "swatch-fan",
        title: "Swatch Fan",
        proPage: "/docs/components/input#swatch-fan",
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
        proPage: "/docs/components/form#flight-search-form",
        line: "A boarding-pass search with an animated swap and a passengers picker.",
      },
      {
        name: "booking-picker",
        title: "Booking Picker",
        proPage: "/docs/components/form#booking-picker",
        line: "Drag a 30-minute window between busy blocks in the host's day.",
      },
      {
        name: "product-options-form",
        title: "Product Options Form",
        proPage: "/docs/components/form#product-options-form",
        line: "A price delta on each option, a rolling total and stock hints.",
      },
      {
        name: "shortcuts-dialog",
        title: "Shortcuts Dialog",
        proPage: "/docs/components/modal#shortcuts-dialog",
        line: "Every shortcut in one sheet, and keys light up as you press them.",
      },
      {
        name: "settings-dialog",
        title: "Settings Dialog",
        proPage: "/docs/components/modal#settings-dialog",
        line: "Changes wait for Save, with a count bar and a dot on edited sections.",
      },
      {
        name: "feedback-composer",
        title: "Feedback Composer",
        proPage: "/docs/components/form#feedback-composer",
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
        proPage: "/docs/components/pricings#ticket-pricing",
        line: "Three plans as printed passes with rolling prices and a barcode stub.",
      },
      {
        name: "layer-stack-pricing",
        title: "Layer Stack Pricing",
        proPage: "/docs/components/pricings#layer-stack-pricing",
        line: "Pick a plan and an isometric stack builds up to it.",
      },
      {
        name: "credit-pack-pricing",
        title: "Credit Pack Pricing",
        proPage: "/docs/components/pricings#credit-pack-pricing",
        line: "Prepaid credit packs with the price per credit and auto top-up.",
      },
      {
        name: "pay-button",
        title: "Pay Button",
        proPage: "/docs/components/button#pay-button",
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
        proPage: "/docs/components/pages/projects-dashboard",
        line: "Project covers, live search and a grid that morphs into a list.",
      },
      {
        name: "billing-usage",
        title: "Billing and Usage",
        proPage: "/docs/components/pages/billing-usage",
        line: "Plan, projected usage meters, prorated changes and invoices.",
      },
      {
        name: "team-calendar-page",
        title: "Team Calendar",
        proPage: "/docs/components/pages/team-calendar-page",
        line: "A team's week with drag to create, a second time zone and RSVPs.",
      },
      {
        name: "storefront-page",
        title: "Storefront",
        proPage: "/docs/components/pages/storefront-page",
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

export const showcaseUrl = (item: ShowcaseItem, medium = "docs-showcase") => {
  const [path, hash] = item.proPage.split("#");
  return `${PRO_URL}${path}?utm_source=kokonutui.com&utm_medium=${medium}&utm_content=${item.name}${hash ? `#${hash}` : ""}`;
};

export const PRO_SHOWCASE_PRICING_URL = `${PRO_URL}/?utm_source=kokonutui.com&utm_medium=docs-showcase#pricing`;
