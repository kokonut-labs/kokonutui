import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ConfettiOutline } from "../icons/conffeti";

/**
 * Pro badge pinned to the bottom of the docs sidebar via `sidebar.footer`,
 * which already supplies the surrounding padding.
 */
export default function HeaderProSmall() {
  return (
    <Link
      className="group mt-2 flex w-full flex-col gap-0.5 rounded-lg bg-[#FF2D55] px-3 py-2.5 tracking-tighter transition-opacity duration-200 hover:opacity-90"
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
      target="_blank"
    >
      <span className="flex w-full items-center gap-2.5">
        <ConfettiOutline className="h-4 w-4 shrink-0 text-white" />
        <span className="min-w-0 flex-1 truncate font-medium text-sm text-white">
          Kokonut UI Pro
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span className="text-sm text-white/90 leading-snug">
        100+ components to build websites faster, works with Claude Code, Cursor
        and more
      </span>
    </Link>
  );
}
