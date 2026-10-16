// The Kokonut UI Pro templates, copied from `lib/data/templates.json` in the
// Pro repo. The docs show them on one page here, so the sidebar never sends
// anyone off-site; leaving is a button the reader chooses to press.

export interface ProTemplate {
  blurb: string;
  category: string;
  name: string;
  /** Only the three on the homepage have a still; the rest use the video. */
  poster?: string;
  previewLink: string;
  price: number;
  slug: string;
  video: string;
}

export const PRO_TEMPLATES_PAGE = "/docs/templates";

export const PRO_TEMPLATE_LIST: ProTemplate[] = [
  {
    slug: "marlow",
    name: "Marlow",
    category: "Portfolio",
    blurb:
      "A portfolio for product designers and design engineers, with case studies and a lab of interactions.",
    price: 59,
    video: "https://cdn.kokonutui.pro/marlow-template.mp4",
    previewLink: "https://marlow-template.vercel.app/",
  },
  {
    slug: "agenta",
    name: "Agenta",
    category: "Startups",
    blurb: "Futuristic, with a modern design rich in small details.",
    price: 59,
    video: "https://cdn.kokonutui.pro/agenta-template.mp4",
    poster: "/landing/pro-agenta.webp",
    previewLink: "https://template-agenta.vercel.app/",
  },
  {
    slug: "lume",
    name: "Lume",
    category: "Startups",
    blurb: "Clean and minimal, for startups building AI, agents and SaaS.",
    price: 59,
    video: "https://cdn.kokonutui.pro/preview-luma-template.mp4",
    poster: "/landing/pro-lume.webp",
    previewLink: "https://template-lume.vercel.app/",
  },
  {
    slug: "sonae",
    name: "Sonae",
    category: "AI agents",
    blurb: "Clean and modern, for AI agents.",
    price: 59,
    video: "https://cdn.kokonutui.pro/Sonae%20Template.mp4",
    poster: "/landing/pro-sonae.webp",
    previewLink: "https://template-sonae.vercel.app/",
  },
  {
    slug: "futur",
    name: "Futur",
    category: "Commerce",
    blurb: "A modern template for selling physical products.",
    price: 49,
    video: "https://cdn.kokonutui.pro/Futur%20Template.mp4",
    previewLink: "https://futur-template.vercel.app/",
  },
];

/** The template's entry on the Pro templates page, tagged as coming from here. */
export const proTemplateUrl = (slug: string) =>
  `https://kokonutui.pro/templates?utm_source=kokonutui.com&utm_medium=docs-templates#${slug}`;
