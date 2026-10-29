// Content for the homepage. Everything here is real: categories come from the
// docs tree, posts are copied from the existing testimonials, and commands
// match the registry and the MCP guide.

export interface CategoryItem {
  description?: string;
  name: string;
  title: string;
  url: string;
}

export interface Category {
  items: CategoryItem[];
  slug: string;
  title: string;
}

const REGISTRY_NAMESPACE = "@kokonutui";

export const GITHUB_URL = "https://github.com/kokonut-labs/kokonutui";
export const VERCEL_OSS_URL =
  "https://vercel.com/blog/spring25-oss-program#kokonutui";

// The one line people add to components.json (see /docs).
export const REGISTRY_ENTRY = `"${REGISTRY_NAMESPACE}": "https://kokonutui.com/r/{name}.json"`;

export const installCommand = (name: string) =>
  `npx shadcn@latest add ${REGISTRY_NAMESPACE}/${name}`;

// The four clients with first-class `mcp init` support (see /docs/agents).
export const MCP_CLIENTS = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "vscode", label: "VS Code" },
  { id: "codex", label: "Codex" },
] as const;

export type McpClient = (typeof MCP_CLIENTS)[number]["id"];

export const mcpCommand = (client: McpClient) =>
  `npx shadcn@latest mcp init --client ${client}`;

export interface Post {
  avatar: string;
  date?: string;
  handle: string;
  href?: string;
  name: string;
  text: string;
}

// Real posts about KokonutUI, quoted verbatim.
export const POSTS: Post[] = [
  {
    name: "Rexan Wong",
    handle: "rexan_wong",
    avatar:
      "https://pbs.twimg.com/profile_images/1872649737310224385/ZG73VN1s_x96.jpg",
    text: "if you use @shadcn ui for your apps, you're gonna love these 7 ui libraries: kokonutui.com",
    date: "Dec 16, 2025",
  },
  {
    name: "Rajiv S",
    handle: "rjv_im",
    avatar:
      "https://pbs.twimg.com/profile_images/1842868023289430017/ZCnfeP5L_x96.jpg",
    text: "Super cool background paths by @dorianbaffier's, check out https://kokonutui.com",
  },
  {
    name: "OrcDev",
    handle: "orcdev",
    avatar:
      "https://pbs.twimg.com/profile_images/1756766826736893952/6Gvg6jha_x96.jpg",
    text: "3 React @shadcn libraries you NEED to know! 🔥",
  },
  {
    name: "Nitro",
    handle: "Mehdi_B_25",
    avatar:
      "https://pbs.twimg.com/profile_images/1834941026051481600/R6Mi43Sk_x96.jpg",
    text: "Looking to add animations and beautiful components to your website? Check out these two UI libraries for @nextjs + @tailwindcss",
  },
  {
    name: "Toolfolio",
    handle: "toolfolio",
    avatar:
      "https://pbs.twimg.com/profile_images/1979166137083404288/p8GVBB-M_x96.png",
    text: "KokonutUI Open Source - Interactive UI components built with Tailwind CSS & shadcn for React and Next.js",
  },
];

// The v0 launch post and shadcn's reply.
export const V0_THREAD = {
  post: {
    name: "Dorian",
    handle: "dorianbaffier",
    avatar:
      "https://pbs.twimg.com/profile_images/1992215290936205312/N_EuwLUO_400x400.jpg",
    text: "All components from KokonutUI can now be open in @v0 🎉",
    steps: [
      "Click on 'Open in V0'",
      "Customize with prompts",
      "Deploy to your app",
    ],
    date: "Jan 18, 2025",
    href: "https://x.com/dorianbaffier/status/1880291036410572934",
  },
  reply: {
    name: "shadcn",
    handle: "shadcn",
    avatar:
      "https://pbs.twimg.com/profile_images/1593304942210478080/TUYae5z7_400x400.jpg",
    text: "Awesome.",
    date: "Jan 18",
  },
} as const;

export const VIDEO_ID = "2Fj3WewGRow";

// The offer as kokonutui.pro shows it (Pro's config/pricing.ts and
// INCLUDED); change both together.
export const PRO_PRICE = { list: 159, code: "PRO25", percent: 25, off: 40 };
export const PRO_PRICING_URL =
  "https://kokonutui.pro/?utm_source=kokonutui.com&utm_medium=landing#pricing";
export const PRO_INCLUDED = [
  "Every component and section, as source you own",
  "Every website template, current and future",
  "Install with the shadcn CLI, the MCP server or a prompt",
  "Every future release, no subscription",
] as const;

/** Four Pro stills from /docs/pro, picked to show range: hero, app, AI, card. */
export const PRO_STILLS = [
  "agent-flow-hero",
  "kanban-board",
  "slash-command-menu",
  "onboarding-checklist",
] as const;

export const PRO_TEMPLATES = [
  {
    name: "Agenta",
    blurb: "Futuristic, rich in small details",
    image: "/landing/pro-agenta-2.webp",
    width: 1280,
    height: 800,
  },
  {
    name: "Lume",
    blurb: "For startups building AI and SaaS",
    image: "/landing/pro-lume-2.webp",
    width: 1280,
    height: 800,
  },
  {
    name: "Sonae",
    blurb: "Clean and modern, for AI agents",
    image: "/landing/pro-sonae-2.webp",
    width: 1280,
    height: 800,
  },
] as const;
