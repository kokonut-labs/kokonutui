import Image from "next/image";
import type { Part } from "@/components/landing/home/parts";
import {
  PRO_SHOWCASE,
  PRO_STATS,
  showcaseStill,
  showcaseUrl,
} from "@/lib/pro-showcase";
import { cn } from "@/lib/utils";

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

/** Height over width of each still, so a hero shows whole instead of cropped. */
const RATIO: Record<string, number> = {
  "agent-flow-hero": 1.125,
  "dither-reveal-hero": 0.807,
  "chart-hero": 0.802,
  "terminal-hero": 1.159,
};

/** Pro heroes are page-wide designs: they get the full width of the group. */
export const isProHero = (part: Part) =>
  part.categorySlug === PRO_SLUG && part.name.endsWith("-hero");

export const proRatio = (part: Part) =>
  RATIO[part.name.slice("pro-".length)] ?? 1;

/** Pro in full: everything it sells, not just the components. */
export const PRO_LINE = `${PRO_STATS[0].value} components and website templates`;

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
  // A hero's board has its still's shape; the smaller parts sit whole inside
  // a square board.
  const fit = isProHero(part)
    ? "object-cover object-top"
    : "object-contain p-5";
  return (
    <>
      <Image
        alt={part.title}
        className={cn(fit, "dark:hidden")}
        fill
        sizes={isProHero(part) ? "1928px" : "440px"}
        src={showcaseStill(name, "light")}
      />
      <Image
        alt={part.title}
        className={cn(fit, "hidden dark:block")}
        fill
        sizes={isProHero(part) ? "1928px" : "440px"}
        src={showcaseStill(name, "dark")}
      />
    </>
  );
}
