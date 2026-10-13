import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PRO_TEMPLATES, PRO_TEMPLATES_URL, PRO_URL } from "./data";
import { EASE_COLORS, FOCUS } from "./styles";

// The panel is dark in both themes, so the ring's offset matches it.
const FOCUS_ON_DARK = cn(
  FOCUS,
  "focus-visible:ring-white/40 focus-visible:ring-offset-[#0a0a0a]"
);

export function Pro() {
  return (
    <section className="pt-28 md:pt-36">
      <div className="rounded-3xl bg-[#0a0a0a] p-6 sm:p-10 lg:p-14 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[560px]">
            <p className="mb-4 font-medium text-[#FF2D55] text-[14px]">
              Kokonut UI Pro
            </p>
            <h2 className="text-balance font-semibold text-[32px] text-white leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
              From components to complete pages.
            </h2>
            <p className="mt-4 text-pretty text-[16px] text-white/60 leading-relaxed">
              Pro adds premium sections and full website templates, built on the
              same stack with the same care: Next.js, Tailwind CSS, Motion and
              shadcn/ui.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 font-medium text-[14px] text-black hover:bg-white/90 active:bg-white/80",
                EASE_COLORS,
                FOCUS_ON_DARK
              )}
              href={PRO_URL}
              rel="noreferrer"
              target="_blank"
            >
              Explore Pro
              <ArrowUpRightIcon aria-hidden className="size-4" />
            </a>
            <a
              className={cn(
                "inline-flex h-10 items-center rounded-lg px-4 font-medium text-[14px] text-white/70 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12]",
                EASE_COLORS,
                FOCUS_ON_DARK
              )}
              href={PRO_TEMPLATES_URL}
              rel="noreferrer"
              target="_blank"
            >
              All templates
            </a>
          </div>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
          {PRO_TEMPLATES.map((template) => (
            <li key={template.name}>
              <a
                className={cn("group block rounded-xl", FOCUS_ON_DARK)}
                href={PRO_TEMPLATES_URL}
                rel="noreferrer"
                target="_blank"
              >
                <span className="block overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition-[box-shadow] duration-150 ease-out group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35)]">
                  <Image
                    alt={`${template.name} template`}
                    className="aspect-[16/10] w-full object-cover object-top"
                    height={template.height}
                    sizes="(min-width: 640px) 360px, 100vw"
                    src={template.image}
                    width={template.width}
                  />
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="font-medium text-[14px] text-white/85 transition-colors duration-150 ease-out group-hover:text-white">
                    {template.name}
                  </span>
                  <span className="truncate text-[13px] text-white/55">
                    {template.blurb}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
