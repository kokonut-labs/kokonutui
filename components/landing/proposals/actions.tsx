"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import Link from "next/link";
import CommandButton from "@/components/kokonutui/command-button";
import { cn } from "@/lib/utils";

/**
 * The two ways in, drawn as a pair: Browse is the Search button's shape in
 * ink, its count set on a cap where Search has its keys. Nothing moves; hover
 * reads through color alone.
 */
export function ProposalActions({ count }: { count: number }) {
  const { setOpenSearch } = useSearchContext();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Link
        className={cn(
          "inline-flex h-10 items-center gap-3 rounded-full border border-black bg-black py-1 pr-2 pl-4 font-medium text-sm text-white",
          "hover:border-black/80 hover:bg-black/80",
          "dark:border-white dark:bg-white dark:text-black dark:hover:border-white/85 dark:hover:bg-white/85",
          "transition-[background-color,border-color] duration-150 ease-out",
          "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-black"
        )}
        href="/docs"
      >
        Browse components
        <span
          aria-hidden="true"
          className="mb-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 bg-white/10 px-1.5 font-medium text-[11px] text-white/85 tabular-nums leading-none shadow-[0_2px_0_0_rgb(255_255_255/0.12)] dark:border-black/10 dark:bg-black/[0.06] dark:text-black/70 dark:shadow-[0_2px_0_0_rgb(0_0_0/0.1)]"
        >
          {count}
        </span>
      </Link>
      {/* data-search-intent: pointing at it starts loading the search code. */}
      <span className="contents" data-search-intent>
        <CommandButton
          className="rounded-full border-black/[0.13] bg-white pl-4 text-black/70 hover:border-black/30 hover:bg-white hover:text-black dark:border-white/[0.14] dark:bg-black dark:text-white/70 dark:hover:border-white/35 dark:hover:bg-black dark:hover:text-white"
          onClick={() => setOpenSearch(true)}
        >
          Search
        </CommandButton>
      </span>
    </div>
  );
}
