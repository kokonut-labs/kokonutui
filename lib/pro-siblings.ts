import {
  PRO_SHOWCASE,
  type ShowcaseItem,
  showcaseUrl,
} from "@/lib/pro-showcase";

// Where the OSS docs point at Pro from a component page. Every category gets
// a Pro still beside it (the TOC card), and a few components whose next step
// is a Pro one get a plain line under their demo. The stills and the Pro
// pages come from `lib/pro-showcase.ts`, so nothing here ships Pro code.

const ITEMS = new Map(
  PRO_SHOWCASE.flatMap((group) =>
    group.items.map((item) => [item.name, { ...item, group: group.title }])
  )
);

export type ProPick = ShowcaseItem & { group: string };

const pick = (name: string): ProPick => {
  const item = ITEMS.get(name);
  if (!item) {
    throw new Error(`${name} is not in PRO_SHOWCASE`);
  }
  return item;
};

/**
 * The Pro piece beside each docs category, by its folder. Its still is a
 * crop of the showcase still to the component itself (`public/pro-toc/`), so
 * a lone button isn't a speck in a 240px card; width and height are the
 * crop's.
 */
const CATEGORY_PICKS: Record<string, [name: string, w: number, h: number]> = {
  ai: ["slash-command-menu", 640, 443],
  backgrounds: ["dither-reveal-hero", 640, 375],
  buttons: ["pay-button", 620, 297],
  cards: ["onboarding-checklist", 640, 485],
  components: ["security-bento", 640, 337],
  inputs: ["natural-date-input", 500, 250],
  media: ["audio-player-card", 640, 339],
  navigation: ["docs-search", 433, 333],
  texts: ["kinetic-type-hero", 640, 212],
};

const DEFAULT_PICK = CATEGORY_PICKS.backgrounds;

/** The Pro piece to show beside a docs page in `category`. */
export const proPickFor = (
  category: string | undefined
): { item: ProPick; width: number; height: number } => {
  const [name, width, height] = CATEGORY_PICKS[category ?? ""] ?? DEFAULT_PICK;
  return { item: pick(name), width, height };
};

/**
 * Free components whose next step is a Pro one: the question the reader is
 * likely asking, and the Pro piece that answers it.
 */
const SIBLINGS: Record<string, { ask: string; name: string }> = {
  "slide-to-confirm": { ask: "Taking payments?", name: "pay-button" },
  "card-field": { ask: "Need the button that charges it?", name: "pay-button" },
  "cart-button": { ask: "Selling products?", name: "product-options-form" },
  "receipt-printer": { ask: "Shipping orders?", name: "order-tracker" },
  "ai-prompt": {
    ask: "Want commands in the prompt?",
    name: "slash-command-menu",
  },
  "ai-input-search": { ask: "Searching your docs?", name: "docs-search" },
  "action-search-bar": { ask: "Searching your docs?", name: "docs-search" },
  "stay-picker": { ask: "Taking bookings?", name: "booking-picker" },
  "slot-picker": { ask: "Need the whole week?", name: "calendar-schedule" },
  "timezone-planner": {
    ask: "Need the whole week?",
    name: "calendar-schedule",
  },
  "metric-card": { ask: "Building a billing page?", name: "billing-usage" },
  toolbar: { ask: "Building an editor?", name: "canvas-toolbar" },
  "team-selector": { ask: "Inviting your team?", name: "team-invite-card" },
};

/** The Pro sibling of the free component on `slug`, if it has one. */
export const proSiblingFor = (
  slug: string | undefined
): { ask: string; item: ProPick } | null => {
  const sibling = SIBLINGS[slug ?? ""];
  return sibling ? { ask: sibling.ask, item: pick(sibling.name) } : null;
};

export const proPickUrl = (item: ProPick, medium: string) =>
  showcaseUrl(item, medium);

export const proPickStill = (name: string, theme: "light" | "dark") =>
  `/pro-toc/${name}-${theme}.webp`;
