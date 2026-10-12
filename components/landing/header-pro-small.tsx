import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ConfettiOutline } from "../icons/conffeti";

/**
 * Pro link pinned to the bottom of the docs sidebar via `sidebar.footer`,
 * which already supplies the surrounding padding. Kept quiet on purpose: the
 * TOC banner carries the full pitch, so this should not outshine the nav.
 */
export default function HeaderProSmall() {
  return (
    <Link
      className="group mt-2 flex w-full items-center gap-2.5 rounded-lg border border-[#FF2D55]/20 px-3 py-2 transition-colors duration-150 ease-out hover:border-[#FF2D55]/40 hover:bg-[#FF2D55]/5"
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
      rel="noopener"
      target="_blank"
    >
      <ConfettiOutline className="h-4 w-4 shrink-0 text-[#FF2D55]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground text-sm">
          Kokonut UI Pro
        </span>
        <span className="truncate text-muted-foreground text-xs">
          100+ components and templates
        </span>
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
