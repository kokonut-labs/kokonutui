import Image from "next/image";
import type { Part } from "@/components/landing/home/parts";
import { PRO_SHOWCASE, showcaseStill, showcaseUrl } from "@/lib/pro-showcase";

/** A dozen Pro components for the canvas, one or two from each kind. */
const PICKS = [
  "agent-flow-hero",
  "dither-reveal-hero",
  "chart-hero",
  "terminal-hero",
  "slash-command-menu",
  "kanban-board",
  "calendar-schedule",
  "image-generation-card",
  "order-tracker",
  "flight-search-form",
  "booking-picker",
  "billing-usage",
];

export const PRO_SLUG = "pro";

/** Pro's code color: the red of its own marks. */
export const PRO_RED = "text-[#E5223F] dark:text-[#FF2D55]";

const ITEMS = new Map(
  PRO_SHOWCASE.flatMap((group) => group.items).map((item) => [item.name, item])
);

/**
 * Pro components shaped as catalog parts, so the canvas lays them out like
 * the rest. They show stills, not code: none of Pro ships with this site.
 */
export const PRO_PARTS: Part[] = PICKS.flatMap((name, i) => {
  const item = ITEMS.get(name);
  return item
    ? [
        {
          code: `PRO-${String(i + 1).padStart(2, "0")}`,
          name: `pro-${name}`,
          title: item.title,
          description: item.line,
          url: showcaseUrl(item, "landing-canvas"),
          category: "Pro",
          categorySlug: PRO_SLUG,
          dependencies: [],
          registryDependencies: [],
          files: [],
          isNew: false,
        },
      ]
    : [];
});

/** The Pro component's still, light and dark, filling its artboard. */
export function ProStill({ part }: { part: Part }) {
  const name = part.name.slice("pro-".length);
  return (
    <>
      <Image
        alt={part.title}
        className="object-cover object-top dark:hidden"
        fill
        sizes="440px"
        src={showcaseStill(name, "light")}
      />
      <Image
        alt={part.title}
        className="hidden object-cover object-top dark:block"
        fill
        sizes="440px"
        src={showcaseStill(name, "dark")}
      />
    </>
  );
}
