import { ArrowUpRightIcon, CheckIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "./client";
import { PRO_TEMPLATES, PRO_TEMPLATES_URL, PRO_URL } from "./data";
import { FOCUS, PRESS } from "./styles";

const FEATURES = [
  "Hero, feature, pricing and footer sections",
  "Complete website templates, ready to deploy",
  "Next.js, Tailwind CSS, Motion and shadcn/ui",
  "Works with Claude Code and Cursor",
];

// Resting and hovered transforms for the template previews: two cards behind,
// one in front. Hovering the stack fans them a little further apart.
const FAN = [
  "left-0 top-0 -rotate-[5deg] group-hover:-translate-x-[4%] group-hover:-rotate-[7deg]",
  "left-1/2 bottom-[6%] z-10 -translate-x-1/2 group-hover:-translate-y-[4%]",
  "right-0 top-0 rotate-[5deg] group-hover:translate-x-[4%] group-hover:rotate-[7deg]",
];

export function Pro() {
  return (
    <section className="pt-28 md:pt-36">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#0a0a0a] px-6 py-10 sm:px-10 md:py-14 lg:px-14 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          {/* A faint warm glow behind the cards; Pro's pink, barely there. */}
          <div
            aria-hidden
            className="absolute -top-1/3 right-[-10%] -z-10 aspect-square w-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(255,45,85,0.16),transparent)]"
          />
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <p className="mb-4 inline-flex items-center gap-2 font-medium text-[#FF2D55] text-[13px]">
                <span className="size-1.5 rounded-full bg-[#FF2D55]" />
                Kokonut UI Pro
              </p>
              <h2 className="text-balance font-semibold text-[32px] text-white leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
                From components to complete pages.
              </h2>
              <p className="mt-4 max-w-[440px] text-pretty text-[16px] text-white/60 leading-relaxed">
                Pro adds premium sections and full website templates, made with
                the same care as everything here.
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-[14px] text-white/75">
                {FEATURES.map((feature) => (
                  <li className="flex items-start gap-2.5" key={feature}>
                    <CheckIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-[#FF2D55]"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <a
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 font-medium text-[14px] text-black hover:bg-white/90",
                    PRESS,
                    FOCUS,
                    "focus-visible:ring-white/40 focus-visible:ring-offset-[#0a0a0a]"
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
                    "inline-flex h-10 items-center rounded-lg px-4 font-medium text-[14px] text-white/70 hover:bg-white/[0.08] hover:text-white",
                    PRESS,
                    FOCUS,
                    "focus-visible:ring-white/40 focus-visible:ring-offset-[#0a0a0a]"
                  )}
                  href={PRO_TEMPLATES_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  See templates
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <a
                aria-label="See the Pro templates"
                className={cn(
                  "group relative block aspect-[16/11] w-full rounded-2xl",
                  FOCUS,
                  "focus-visible:ring-white/40 focus-visible:ring-offset-[#0a0a0a]"
                )}
                href={PRO_TEMPLATES_URL}
                rel="noreferrer"
                target="_blank"
              >
                {/* Lume, the most visual of the three, sits in front. */}
                {PRO_TEMPLATES.map((template, i) => (
                  <div
                    className={cn(
                      "absolute w-[58%] overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_24px_48px_-12px_rgba(0,0,0,0.7)] transition-[translate,rotate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                      FAN[i]
                    )}
                    key={template.name}
                  >
                    <Image
                      alt={`${template.name} template`}
                      className="aspect-[16/10] w-full object-cover object-top"
                      height={template.height}
                      sizes="(min-width: 1024px) 400px, 58vw"
                      src={template.image}
                      width={template.width}
                    />
                  </div>
                ))}
              </a>
              <p className="mt-2 text-center text-[13px] text-white/55">
                Agenta, Lume and Sonae, from the Pro templates
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
