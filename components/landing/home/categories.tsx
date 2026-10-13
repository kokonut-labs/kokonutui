import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Category } from "./data";
import { SectionHeading } from "./section-heading";
import { FOCUS } from "./styles";

export function Categories({ categories }: { categories: Category[] }) {
  return (
    <section className="scroll-mt-28 pt-28 md:pt-36" id="browse">
      <SectionHeading
        action={
          <Link
            className={cn(
              "group inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium text-[14px] text-black/65 hover:text-black dark:text-white/65 dark:hover:text-white",
              FOCUS
            )}
            href="/docs"
          >
            Open the docs
            <ArrowRightIcon
              aria-hidden
              className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </Link>
        }
        description="Every component is free and open source, grouped the way the docs are."
        title="Browse by category"
      />
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-4">
        {categories.map((category) => (
          <div
            className="mb-3 break-inside-avoid rounded-2xl border border-black/[0.07] p-5 dark:border-white/[0.08]"
            key={category.slug}
          >
            <h3 className="mb-3 font-medium text-[15px] text-black dark:text-white">
              {category.title}
            </h3>
            <ul className="flex flex-col">
              {category.items.map((item) => (
                <li key={item.url}>
                  <Link
                    className={cn(
                      "group -mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-[14px] text-black/65 hover:bg-black/[0.04] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white",
                      FOCUS
                    )}
                    href={item.url}
                    title={item.description}
                  >
                    {item.title}
                    <ArrowRightIcon
                      aria-hidden
                      className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-60 group-focus-visible:translate-x-0 group-focus-visible:opacity-60"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
