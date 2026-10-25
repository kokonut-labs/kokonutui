import Link from "next/link";
import { getParts } from "@/components/landing/home/parts";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

/**
 * A category's components as catalog rows: code, name and what it does.
 * Server-rendered, so the category page carries every component's summary
 * as text and links, not just a demo.
 */
export function CategoryIndex({ category }: { category: string }) {
  const parts = getParts().filter((part) => part.categorySlug === category);

  return (
    <ul className={cn("not-prose my-8 grid grid-cols-1 border", GRID, LINE)}>
      {parts.map((part) => (
        <li className={CELL} key={part.name}>
          <Link
            className={cn(
              "group flex gap-4 px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={part.url}
          >
            <span
              className={cn(
                MONO,
                "w-[5ch] shrink-0 pt-[3px] text-[11.5px]",
                LEAF
              )}
            >
              {part.code}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex items-baseline gap-3">
                <span
                  className={cn(
                    "font-medium text-[15px] tracking-[-0.01em] underline-offset-4 group-hover:underline",
                    INK
                  )}
                >
                  {part.title}
                </span>
                {part.isNew || part.updated ? (
                  <span className={cn(MONO, "text-[11px]", LEAF)}>
                    {part.isNew ? "New" : "Updated"}
                  </span>
                ) : null}
              </span>
              {part.description ? (
                <span className={cn("text-[14px] leading-relaxed", SOFT)}>
                  {part.description}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
