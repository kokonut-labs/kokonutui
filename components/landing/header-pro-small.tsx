import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { EASE_COLORS, FOCUS, META } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

/**
 * The docs' one mention of Pro: a quiet row at the foot of the sidebar,
 * which already supplies the surrounding padding.
 */
export default function HeaderProSmall() {
  return (
    <Link
      className={cn(
        "group mt-2 flex w-full flex-col gap-0.5 rounded-sm px-2 py-2",
        EASE_COLORS,
        FOCUS
      )}
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
      target="_blank"
    >
      <span className="flex w-full items-center justify-between gap-2 font-medium text-[13px] text-black dark:text-white">
        Kokonut UI Pro
        <ArrowUpRight
          aria-hidden
          className="size-3.5 text-black/40 transition-colors duration-150 ease-out group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
        />
      </span>
      <span className={META}>100+ components to build websites faster</span>
    </Link>
  );
}
