"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  PaletteIcon,
  TerminalIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/animation-presets";

const CLI_COMMAND = "npx shadcn@latest add @kokonutui/<name>";

type Step = {
  number: string;
  Icon: LucideIcon;
  title: string;
  description: string;
  cliCommand?: string;
};

const steps: Step[] = [
  {
    number: "01",
    Icon: GlobeIcon,
    title: "Browse",
    description:
      "Explore 100+ components at kokonutui.com. Filter by category and preview live demos.",
  },
  {
    number: "02",
    Icon: TerminalIcon,
    title: "Install",
    description: "One CLI command adds any component directly to your project.",
    cliCommand: CLI_COMMAND,
  },
  {
    number: "03",
    Icon: PaletteIcon,
    title: "Customize",
    description:
      "Tailwind + React — own your code, no black boxes. Tweak styles and logic freely.",
  },
];

export default function HowItWorks() {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const reduceMotion = useReducedMotion();
  const fadeUpInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 };

  return (
    <section className="w-full py-24 md:py-32" id="how-it-works">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          className="mb-12 text-center md:mb-16"
          initial={fadeUpInitial}
          transition={{ duration: DURATION.marketing, ease: EASE_OUT }}
          viewport={{ once: true, margin: "-100px" }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className="mb-4 font-bold text-3xl text-black tracking-tight md:text-4xl lg:text-5xl dark:text-white">
            Get started in seconds
          </h2>
          <p className="text-balance text-black/70 text-lg md:text-xl dark:text-white/70">
            From browsing to production in three simple steps.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const { Icon } = step;
            return (
              <motion.div
                className="flex flex-col gap-4 rounded-2xl border border-black/[0.06] bg-black/[0.02] p-6 dark:border-white/[0.06] dark:bg-white/[0.02]"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                key={step.number}
                transition={{
                  duration: DURATION.marketing,
                  delay: index * STAGGER.relaxed,
                  ease: EASE_OUT,
                }}
                viewport={{ once: true, margin: "-50px" }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black font-semibold text-white text-xs dark:bg-white dark:text-black">
                    {step.number}
                  </span>
                  <Icon className="h-5 w-5 text-black/50 dark:text-white/50" />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-black text-xl dark:text-white">
                    {step.title}
                  </h3>
                  <p className="text-black/60 text-sm leading-relaxed dark:text-white/60">
                    {step.description}
                  </p>
                </div>
                {step.cliCommand && (
                  <div className="mt-auto flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 font-mono text-xs dark:bg-white/5">
                    <span className="flex-1 text-black/80 dark:text-white/80">
                      {step.cliCommand}
                    </span>
                    <button
                      aria-label={isCopied ? "Copied!" : "Copy command"}
                      className="shrink-0 rounded p-1 text-black/40 transition-colors hover:bg-black/10 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                      onClick={() => copyToClipboard(step.cliCommand ?? "")}
                      type="button"
                    >
                      {isCopied ? (
                        <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
