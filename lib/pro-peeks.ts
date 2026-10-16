// A few Kokonut UI Pro components, listed among the free ones in the docs.
// Visitors see a still of each, sharp at the top and fading out (drawn by
// `bun run stills` in the Pro repo and copied into `public/pro-peeks/`), and
// the rest lives on kokonutui.pro. No Pro code ships with this site.

export interface ProPeek {
  /** The page's name here, and the component's name in the Pro registry. */
  name: string;
  /** The Pro docs page and heading that hold the live component. */
  proPage: string;
  /** What the live version does that the still can't show. */
  live: string[];
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
    live: [
      "The ring fills as steps are checked",
      "Done steps collapse, the next one opens",
      "An all-set state once every step is done",
    ],
    still: { width: 808, height: 545, pill: 0.823 },
  },
  {
    name: "pay-button",
    proPage: "/docs/components/button#pay-button",
    live: [
      "Digits roll when the seats or the period change",
      "Press shows Processing, then Paid",
      "A declined card says so on the button",
    ],
    still: { width: 808, height: 400, pill: 0.695 },
  },
  {
    name: "slash-command-menu",
    proPage: "/docs/components/action-search-bar#slash-command-menu",
    live: [
      "Type / to pick a command",
      "A hint bar fills in each argument as you type",
      "Commands post to the thread, polls included",
    ],
    still: { width: 808, height: 466, pill: 0.813 },
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
