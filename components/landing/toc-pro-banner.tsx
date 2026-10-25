import { ArrowUpRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  INK,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { showcaseStill } from "@/lib/pro-showcase";
import { cn } from "@/lib/utils";

const FEATURES = [
  "100+ components to build websites faster",
  "Works with Claude Code, Cursor and more",
  "One command installation with shadcn/cli",
] as const;

/** The still beside every docs page: a Pro hero, in the page's theme. */
const STILL = { name: "dither-reveal-hero", title: "Dither Reveal Hero" };

/**
 * Pro beside every docs page, drawn like a catalog cell: a hairline frame,
 * square corners and mono labels. Pro's red is the highlight, on its code and
 * on the bar that closes the card.
 */
export default function TocProBanner() {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link
        className={cn("group flex w-full flex-col border", CELL, LINE, FOCUS)}
        href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=toc"
        rel="noopener"
        target="_blank"
      >
        <span className="flex items-baseline justify-between px-3.5 pt-3">
          <span className={cn(MONO, "font-medium text-[#FF2D55] text-[12px]")}>
            PRO
          </span>
          <span className={META}>Heroes</span>
        </span>
        <span className="block px-3.5 pt-3">
          <span className="block overflow-hidden border border-black/[0.08] dark:border-white/[0.1]">
            <Image
              alt={`${STILL.title}, a Kokonut UI Pro component`}
              className="aspect-[16/10] w-full object-cover object-top dark:hidden"
              height={1736}
              sizes="240px"
              src={showcaseStill(STILL.name, "light")}
              width={2152}
            />
            <Image
              alt=""
              className="hidden aspect-[16/10] w-full object-cover object-top dark:block"
              height={1736}
              sizes="240px"
              src={showcaseStill(STILL.name, "dark")}
              width={2152}
            />
          </span>
        </span>
        <span className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span
            className={cn(
              "font-medium text-[15px] tracking-[-0.01em] underline-offset-4 group-hover:underline",
              INK
            )}
          >
            Kokonut UI Pro
          </span>
          <span className={cn("text-[13px] leading-snug", SOFT)}>
            Build beautiful websites faster.
          </span>
        </span>
        <ul className={cn("border-t", LINE)}>
          {FEATURES.map((feature) => (
            <li
              className={cn(
                "flex items-start gap-2 border-b px-3.5 py-2 text-[12.5px] leading-snug",
                LINE,
                SOFT
              )}
              key={feature}
            >
              <Check
                aria-hidden
                className="mt-0.5 size-3 shrink-0 text-[#FF2D55]"
                strokeWidth={2.5}
              />
              {feature}
            </li>
          ))}
        </ul>
        <span
          className={cn(
            "flex h-10 items-center justify-between bg-[#FF2D55] px-3.5 font-medium text-[13px] text-white group-hover:bg-[#E6284D] group-active:bg-[#D12447]",
            EASE_COLORS
          )}
        >
          Explore Kokonut UI Pro
          <ArrowUpRight aria-hidden className="size-3.5" />
        </span>
      </Link>
      <span className={META}>Trusted by 10k+ users worldwide</span>
    </div>
  );
}
