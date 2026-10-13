import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  INK,
  LINE,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

/**
 * Pro pinned to the bottom of the docs sidebar via `sidebar.footer`, which
 * already supplies the surrounding padding. A hairline cell like the rest of
 * the catalog; Pro's red marks only its code and arrow.
 */
export default function HeaderProSmall() {
  return (
    <Link
      className={cn(
        "group mt-2 flex w-full flex-col gap-1 border px-3 py-2.5 hover:border-[#FF2D55]/50",
        CELL,
        LINE,
        EASE_COLORS,
        FOCUS
      )}
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
      target="_blank"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className={cn(MONO, "font-medium text-[#FF2D55] text-[11px]")}>
            PRO
          </span>
          <span
            className={cn("font-medium text-[13.5px] tracking-[-0.01em]", INK)}
          >
            Kokonut UI Pro
          </span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-3.5 shrink-0 text-[#FF2D55]"
        />
      </span>
      <span className={cn("text-[12.5px] leading-snug", SOFT)}>
        100+ components to build websites faster, works with Claude Code, Cursor
        and more
      </span>
    </Link>
  );
}
