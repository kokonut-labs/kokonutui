import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { EASE_COLORS, FOCUS, MONO } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

/**
 * Pro pinned to the bottom of the docs sidebar via `sidebar.footer`, which
 * already supplies the surrounding padding. A square block of Pro's red, with
 * the same mono code the sidebar lists components by.
 */
export default function HeaderProSmall() {
  return (
    <Link
      className={cn(
        "group mt-2 flex w-full flex-col gap-1 bg-[#FF2D55] px-3 py-2.5 text-white hover:bg-[#E6284D] active:bg-[#D12447]",
        EASE_COLORS,
        FOCUS
      )}
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
      target="_blank"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className={cn(MONO, "font-medium text-[11px] text-white/70")}>
            PRO
          </span>
          <span className="font-medium text-[14px] tracking-[-0.01em]">
            Kokonut UI Pro
          </span>
        </span>
        <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
      </span>
      <span className="text-[12.5px] text-white/85 leading-snug">
        100+ components to build websites faster, works with Claude Code, Cursor
        and more
      </span>
    </Link>
  );
}
