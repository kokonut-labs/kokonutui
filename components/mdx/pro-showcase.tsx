import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  GRID,
  INK,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import {
  getShowcaseGroup,
  PRO_SHOWCASE_COUNT,
  PRO_SHOWCASE_PRICING_URL,
  PRO_STATS,
  showcaseStill,
  showcaseUrl,
} from "@/lib/pro-showcase";
import { cn } from "@/lib/utils";

const PRO_RED = "text-[#FF2D55]";

/** The still fades out the way it does on kokonutui.pro, cut to one height. */
const FADE = {
  maskImage: "linear-gradient(to bottom, #000 55%, transparent 96%)",
  WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 96%)",
};

/**
 * The page's header strip: how much Pro holds, and the one way in. Drawn
 * like the catalog's index row, hairlines and mono figures, no card.
 */
export function ProShowcaseIntro() {
  return (
    <div className={cn("not-prose mt-6 border", LINE, CELL)}>
      <dl className={cn("grid grid-cols-3", GRID)}>
        {PRO_STATS.map((stat) => (
          <div className={cn("px-3.5 py-3", CELL)} key={stat.label}>
            <dt className={META}>{stat.label}</dt>
            <dd
              className={cn(
                MONO,
                "mt-1 text-[22px] tabular-nums tracking-[-0.02em]",
                INK
              )}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className={cn("flex border-t", LINE, GRID)}>
        <p
          className={cn(
            "flex h-10 flex-1 items-center px-3.5 text-[13px]",
            CELL,
            SOFT
          )}
        >
          {PRO_SHOWCASE_COUNT} shown below
        </p>
        <a
          className={cn(
            "flex h-10 flex-1 items-center justify-between px-3.5 font-medium text-[13px]",
            CELL,
            PRO_RED,
            "hover:bg-[#FF2D55]/[0.06]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={PRO_SHOWCASE_PRICING_URL}
          rel="noopener"
          target="_blank"
        >
          Get Kokonut UI Pro
          <span className={cn(MONO, "text-[11px]")}>PRO</span>
        </a>
      </div>
    </div>
  );
}

/**
 * One Pro category as a grid of stills. Each cell opens the component's
 * section in Pro's docs, where it runs; here it's a picture and a line.
 */
export function ProShowcase({ group }: { group: string }) {
  const found = getShowcaseGroup(group);
  if (!found) {
    return null;
  }

  return (
    <div
      className={cn("not-prose mt-4 grid border sm:grid-cols-2", GRID, LINE)}
    >
      {found.items.map((item, index) => (
        <a
          className={cn(
            "group flex flex-col",
            CELL,
            "hover:bg-black/[0.025] dark:hover:bg-white/[0.04]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={showcaseUrl(item)}
          key={item.name}
          rel="noopener"
          target="_blank"
        >
          <div
            className={cn("relative aspect-[4/3] overflow-clip border-b", LINE)}
            style={FADE}
          >
            <Image
              alt={`${item.title}, a Kokonut UI Pro component`}
              className="object-cover object-top dark:hidden"
              fill
              sizes="(min-width: 640px) 420px, 100vw"
              src={showcaseStill(item.name, "light")}
              unoptimized
            />
            <Image
              alt=""
              className="hidden object-cover object-top dark:block"
              fill
              sizes="(min-width: 640px) 420px, 100vw"
              src={showcaseStill(item.name, "dark")}
              unoptimized
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-4">
            <p className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "font-medium text-[15px] tracking-[-0.01em]",
                  INK
                )}
              >
                {item.title}
              </span>
              <span
                className={cn(
                  META,
                  "inline-flex shrink-0 items-center gap-1 group-hover:text-[#FF2D55]",
                  EASE_COLORS
                )}
              >
                {String(index + 1).padStart(2, "0")}
                <ArrowUpRight aria-hidden className="size-3" />
              </span>
            </p>
            <p className={cn("text-[13px] leading-snug", SOFT)}>{item.line}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
