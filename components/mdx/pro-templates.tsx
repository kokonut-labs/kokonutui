import { ArrowUpRight } from "lucide-react";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  GRID,
  INK,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { TemplateVideo } from "@/components/mdx/template-video";
import { PRO_TEMPLATE_LIST, proTemplateUrl } from "@/lib/pro-templates";
import { cn } from "@/lib/utils";

const ACTION = cn(
  "flex h-10 flex-1 items-center justify-between px-3.5 font-medium text-[13px]",
  EASE_COLORS,
  FOCUS_INSET
);

/**
 * Every Pro template on one docs page, drawn like the catalog: hairline cells,
 * square corners, mono labels. The reader stays here to compare them; the
 * live preview opens in a new tab and "Get template" goes to Pro, both by
 * choice.
 */
export function ProTemplates() {
  return (
    <div
      className={cn("not-prose mt-6 grid border sm:grid-cols-2", GRID, LINE)}
    >
      {PRO_TEMPLATE_LIST.map((t) => (
        <article
          className={cn("group flex flex-col", CELL)}
          data-template-card
          id={t.slug}
          key={t.slug}
        >
          <div className={cn("border-b", LINE)}>
            <TemplateVideo
              alt={`${t.name}, a Kokonut UI Pro template`}
              poster={t.poster}
              src={t.video}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-4">
            <p className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "font-medium text-[15px] tracking-[-0.01em]",
                  INK
                )}
              >
                {t.name}
              </span>
              <span className={META}>
                {t.category} · ${t.price}
              </span>
            </p>
            <p className={cn("text-[13px] leading-snug", SOFT)}>{t.blurb}</p>
          </div>
          <div className={cn("flex border-t", LINE, GRID)}>
            <a
              className={cn(
                ACTION,
                CELL,
                INK,
                "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
              href={t.previewLink}
              rel="noopener"
              target="_blank"
            >
              Live preview
              <ArrowUpRight aria-hidden className="size-3.5 opacity-60" />
            </a>
            <a
              className={cn(
                ACTION,
                CELL,
                "text-[#FF2D55] hover:bg-[#FF2D55]/[0.06]"
              )}
              href={proTemplateUrl(t.slug)}
            >
              Get template
              <span className={cn(MONO, "text-[11px]")}>PRO</span>
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
