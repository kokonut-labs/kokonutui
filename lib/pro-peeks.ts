// A few Kokonut UI Pro components, listed among the free ones in the docs.
// Visitors see a still of each, sharp at the top and fading out (drawn by
// `bun run stills` in the Pro repo and copied into `public/pro-peeks/`), and
// the rest lives on kokonutui.pro. No Pro code ships with this site.

export interface ProPeek {
  /** The page's name here, and the component's name in the Pro registry. */
  name: string;
  /** The Pro docs page and heading that hold the live component. */
  proPage: string;
  /** What the component does that the still can't show. */
  features: string[];
  still: {
    /** CSS pixels; the files are drawn at twice this. */
    width: number;
    height: number;
    /** Where the Unlock pill sits, as a share of the height. */
    pill: number;
  };
}

const PRO_URL = "https://kokonutui.pro";

export const PRO_PEEKS: ProPeek[] = [
  {
    name: "onboarding-checklist",
    proPage: "/docs/components/card#onboarding-checklist",
    features: [
      "The ring fills as steps are checked",
      "Done steps collapse, the next one opens",
      "An all-set state once every step is done",
    ],
    still: { width: 808, height: 545, pill: 0.823 },
  },
  {
    name: "pay-button",
    proPage: "/docs/components/button#pay-button",
    features: [
      "Digits roll when the seats or the period change",
      "Press shows Processing, then Paid",
      "A declined card says so on the button",
    ],
    still: { width: 808, height: 400, pill: 0.695 },
  },
  {
    name: "slash-command-menu",
    proPage: "/docs/components/action-search-bar#slash-command-menu",
    features: [
      "Type / to pick a command",
      "A hint bar fills in each argument as you type",
      "Commands post to the thread, polls included",
    ],
    still: { width: 808, height: 466, pill: 0.813 },
  },
  {
    name: "image-generation-card",
    proPage: "/docs/components/card#image-generation-card",
    features: [
      "Generate resolves the image from coarse pixels to sharp",
      "A step counter runs while it develops",
      "Four variations land, and the ratio can change",
    ],
    still: { width: 808, height: 624, pill: 0.83 },
  },
  {
    name: "swatch-fan",
    proPage: "/docs/components/input#swatch-fan",
    features: [
      "Drag the deck open like a paint fan",
      "Pick a hue, then a shade on its blade",
      "Copy the hex, or move with the arrow keys",
    ],
    still: { width: 808, height: 400, pill: 0.764 },
  },
  {
    name: "price-range",
    proPage: "/docs/components/input#price-range",
    features: [
      "Two handles over a histogram of the results",
      "Bars inside the range fill in as you drag",
      "The count of results updates with every move",
    ],
    still: { width: 808, height: 400, pill: 0.764 },
  },
  {
    name: "audio-player-card",
    proPage: "/docs/components/card#audio-player-card",
    features: [
      "Scrub anywhere on the waveform",
      "Chapter names show as you pass them",
      "A speed chip cycles the playback rate",
    ],
    still: { width: 808, height: 400, pill: 0.796 },
  },
  {
    name: "rhythm-hero",
    proPage: "/docs/components/heroes#rhythm-hero",
    features: [
      "Hairline rings breathe a 4-7-8 cycle",
      "A week of sleep-stage bars below the fold",
      "Pause and resume the breathing",
    ],
    still: { width: 1076, height: 979, pill: 0.879 },
  },
  {
    name: "dither-reveal-hero",
    proPage: "/docs/components/heroes#dither-reveal-hero",
    features: [
      "The prompt types itself in",
      "The scene resolves from coarse dither to full detail",
      "Seeds and prompt chips start a new picture",
    ],
    still: { width: 1076, height: 867, pill: 0.879 },
  },
  {
    name: "kinetic-type-hero",
    proPage: "/docs/components/heroes#kinetic-type-hero",
    features: [
      "The edge-to-edge headline sets itself in",
      "Letters lean away from the cursor",
      "Studio details and a reel strip below",
    ],
    still: { width: 1076, height: 958, pill: 0.879 },
  },
];

const BY_NAME = new Map(PRO_PEEKS.map((peek) => [peek.name, peek]));

export const getProPeek = (name: string) => BY_NAME.get(name);

/** Pro pages sit in the free categories, so tell them apart by name. */
export const isProPeekUrl = (url: string) =>
  BY_NAME.has(url.split("/").at(-1) ?? "");

export const proPeekUrl = (peek: ProPeek, medium = "docs-peek") => {
  const [path, hash] = peek.proPage.split("#");
  return `${PRO_URL}${path}?utm_source=kokonutui.com&utm_medium=${medium}&utm_content=${peek.name}${hash ? `#${hash}` : ""}`;
};

export const PRO_PRICING_URL = `${PRO_URL}/?utm_source=kokonutui.com&utm_medium=docs-peek#pricing`;

export const peekStill = (name: string, theme: "light" | "dark") =>
  `/pro-peeks/${name}-${theme}.webp`;
