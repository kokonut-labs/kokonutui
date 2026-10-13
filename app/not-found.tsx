import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const LINK = cn(
  "group flex items-center justify-between gap-4 px-5 py-4 font-medium text-[15px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
  INK,
  CELL,
  EASE_COLORS,
  FOCUS
);

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
      <div className={cn("w-full max-w-md border", LINE)}>
        <div className={cn("flex flex-col gap-3 p-6", CELL)}>
          <p className="flex items-baseline justify-between gap-4">
            <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
              404
            </span>
            <span className={META}>Not in the catalog</span>
          </p>
          <h1 className={cn("font-semibold text-3xl tracking-[-0.03em]", INK)}>
            No part here.
          </h1>
          <p className={cn("text-[15px] leading-relaxed", SOFT)}>
            This page doesn&apos;t exist or has moved. Every component is listed
            in the docs.
          </p>
        </div>
        <nav aria-label="Where to go" className={cn("border-t", LINE)}>
          <Link className={cn(LINK, "border-b", LINE)} href="/docs">
            Browse the components
            <ArrowRightIcon
              aria-hidden
              className="size-4 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
            />
          </Link>
          <Link className={LINK} href="/">
            Back to the homepage
            <ArrowRightIcon
              aria-hidden
              className="size-4 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
            />
          </Link>
        </nav>
      </div>
    </main>
  );
}
