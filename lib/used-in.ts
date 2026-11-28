// Components that run in a real app, named in one line under their demo.
// Only list a component the app actually ships, or a version of it: the line
// says "This component is used in …", and a claim that isn't true makes the
// true ones look made up too.

export interface UsedInApp {
  name: string;
  /** Shown in the hover card, without the protocol. */
  domain: string;
  url: string;
  /** One line on what the app is, for the hover card. */
  pitch: string;
  /** The app's share image, 560×294, in `public/used-in/`. */
  image: string;
  /** A square mark, in `public/used-in/`. */
  icon: string;
}

const POSTRIPPL: UsedInApp = {
  name: "Postrippl",
  domain: "postrippl.com",
  url: "https://postrippl.com/",
  pitch:
    "The social media scheduler for people who work in Claude, ChatGPT or Cursor. One prompt posts to 10 platforms.",
  image: "/used-in/postrippl.webp",
  icon: "/used-in/postrippl-icon.svg",
};

/** By registry name. */
const USED_IN: Record<string, UsedInApp> = {
  "ai-post": POSTRIPPL,
};

export const usedInFor = (slug: string | undefined) =>
  slug ? USED_IN[slug] : undefined;

/** The app's link, tagged so its own analytics can tell where a visit began. */
export const usedInUrl = (app: UsedInApp, slug: string) =>
  `${app.url}?utm_source=kokonutui&utm_medium=used-in&utm_content=${slug}`;
