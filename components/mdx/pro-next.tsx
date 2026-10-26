import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  EASE_COLORS,
  FOCUS,
  INK,
  LINE,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { proPickFor, proPickUrl, proSiblingFor } from "@/lib/pro-siblings";
import { cn } from "@/lib/utils";

/**
 * One plain line under a component's demo that points at Pro. A component
 * whose next step is a Pro one names it on every screen; the rest only get a
 * line below `xl`, where the TOC card beside the page isn't shown.
 */
export function ProNext({
  category,
  slug,
}: {
  category: string | undefined;
  slug: string | undefined;
}) {
  const sibling = proSiblingFor(slug);
  const { item } = sibling ?? proPickFor(category);

  return (
    <p
      className={cn(
        "not-prose my-6 flex items-baseline gap-3 border-y py-3 text-[14px] leading-snug",
        LINE,
        SOFT,
        !sibling && "xl:hidden"
      )}
      data-nosnippet
    >
      <span
        className={cn(MONO, "shrink-0 font-medium text-[#FF2D55] text-[12px]")}
      >
        PRO
      </span>
      <span className="min-w-0 flex-1">
        {sibling ? `${sibling.ask} ` : `${item.title} and more like it are in `}
        <Link
          className={cn(
            "inline-flex items-baseline gap-0.5 font-medium underline-offset-4 hover:underline",
            INK,
            EASE_COLORS,
            FOCUS
          )}
          href={proPickUrl(item, sibling ? "pro-next" : "pro-next-small")}
          rel="noopener"
          target="_blank"
        >
          {sibling ? `${item.title} is in Kokonut UI Pro` : "Kokonut UI Pro"}
          <ArrowUpRight aria-hidden className="size-3.5 self-center" />
        </Link>
      </span>
    </p>
  );
}
