// Shared content for the landing page prototypes. Everything here is real:
// categories come from the docs tree, quotes are copied from the existing
// testimonials, and install commands match the registry.

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

export interface VariantProps {
  categories: Category[];
  total: number;
}

export const REGISTRY_NAMESPACE = "@kokonutui";
export const MCP_COMMAND = "npx shadcn@latest mcp init --client claude";
export const GITHUB_URL = "https://github.com/kokonut-labs/kokonutui";
export const PRO_URL =
  "https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=landing";
export const PRO_TEMPLATES_URL =
  "https://kokonutui.pro/templates?utm_source=kokonutui.com&utm_medium=landing";

export const installCommand = (name: string) =>
  `npx shadcn@latest add ${REGISTRY_NAMESPACE}/${name}`;

export const docsUrl = (categories: Category[], name: string) => {
  for (const category of categories) {
    const item = category.items.find((i) => i.name === name);
    if (item) {
      return item.url;
    }
  }
  return "/docs";
};

export interface Quote {
  date?: string;
  handle: string;
  name: string;
  text: string;
}

// Verbatim from components/landing/testimonials-data.tsx and the inline
// v0 tweet in testimonials.tsx.
export const QUOTES: Quote[] = [
  {
    name: "Rajiv S",
    handle: "rjv_im",
    text: "Super cool background paths by @dorianbaffier's, check out https://kokonutui.com",
  },
  {
    name: "Nitro",
    handle: "Mehdi_B_25",
    text: "Looking to add animations and beautiful components to your website? Check out these two UI libraries for @nextjs + @tailwindcss",
  },
  {
    name: "Toolfolio",
    handle: "toolfolio",
    text: "KokonutUI Open Source - Interactive UI components built with Tailwind CSS & shadcn for React and Next.js",
  },
  {
    name: "Rexan Wong",
    handle: "rexan_wong",
    text: "if you use @shadcn ui for your apps, you're gonna love these 7 ui libraries: kokonutui.com",
    date: "Dec 16, 2025",
  },
  {
    name: "OrcDev",
    handle: "orcdev",
    text: "3 React @shadcn libraries you NEED to know! 🔥",
  },
  {
    name: "shadcn",
    handle: "shadcn",
    text: "Awesome.",
    date: "Jan 18, 2025",
  },
];

export const STACK = [
  "React 19",
  "Tailwind CSS v4",
  "Motion",
  "shadcn/ui",
] as const;
