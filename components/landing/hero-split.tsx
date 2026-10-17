"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Gemini from "@/components/icons/gemini";
import OpenAIDark from "@/components/icons/open-ai-dark";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { Claude } from "@/components/ui/svgs/claude";
import { CursorDark } from "@/components/ui/svgs/cursor-dark";
import { GrokDark } from "@/components/ui/svgs/grok-dark";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { DURATION, EASE_EXPO_OUT, EASE_OUT } from "@/lib/animation-presets";

const MCP_COMMAND = "npx shadcn@latest mcp init --client claude";
const RESOLVE_DELAY_MS = 1600;

const INSTALLED_ROWS = [
  { name: "@kokonutui/particle-button", time: "1.2s" },
  { name: "@kokonutui/liquid-glass-card", time: "0.9s" },
  { name: "@kokonutui/type-writer", time: "0.8s" },
];

// Delays for the mount cascade: copy first, then panels, then chrome.
const DELAY = {
  heading: 0,
  sub: 0.05,
  cta: 0.1,
  leftPanel: 0.16,
  rightPanel: 0.2,
  node: 0.35,
  rowBase: 0.55,
  rowStep: 0.24,
} as const;

const PREVIEW_TILE_CLASS =
  "flex h-[132px] flex-col items-center justify-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.02]";

const PREVIEW_LABEL_CLASS =
  "font-mono text-[11px] text-black/55 dark:text-white/55";

export function HeroSplit() {
  const reduceMotion = useReducedMotion();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const [lastRowDone, setLastRowDone] = useState(false);
  const resolveTimer = useRef<number | null>(null);

  // Gate the entrance by one frame so the cascade starts from a settled paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setLastRowDone(true);
      return;
    }
    resolveTimer.current = window.setTimeout(
      () => setLastRowDone(true),
      RESOLVE_DELAY_MS
    );
    return () => {
      if (resolveTimer.current !== null) {
        clearTimeout(resolveTimer.current);
      }
    };
  }, [reduceMotion]);

  const scale = reduceMotion ? 0.5 : 1;
  const copyHidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 8, filter: "blur(6px)" };
  const copyVisible = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" };
  const copyEntrance = (delay: number) => ({
    initial: copyHidden,
    animate: mounted ? copyVisible : undefined,
    transition: {
      duration: DURATION.marketing,
      delay: delay * scale,
      ease: EASE_EXPO_OUT,
    },
  });

  const panelHidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 };
  const panelVisible = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const panelEntrance = (delay: number) => ({
    initial: panelHidden,
    animate: mounted ? panelVisible : undefined,
    transition: {
      duration: DURATION.marketing,
      delay: delay * scale,
      ease: EASE_EXPO_OUT,
    },
  });

  const rowEntrance = (delay: number) => ({
    initial: { opacity: 0 },
    animate: mounted ? { opacity: 1 } : undefined,
    transition: {
      duration: DURATION.base,
      delay: reduceMotion ? 0 : delay,
      ease: EASE_OUT,
    },
  });

  return (
    <div className="container mx-auto flex max-w-7xl flex-col justify-center gap-10 px-4 py-16 md:gap-12 md:py-24">
      {/* Headline */}
      <div className="flex flex-col items-center gap-5 text-center">
        <motion.h1
          className="text-balance font-bold text-4xl text-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl dark:text-white"
          {...copyEntrance(DELAY.heading)}
        >
          Components humans browse.
          <br />
          <span className="text-black/45 dark:text-white/50">Agents ship.</span>
        </motion.h1>
        <motion.p
          className="max-w-xl text-balance text-base text-black/70 tracking-tighter md:text-lg dark:text-white/70"
          {...copyEntrance(DELAY.sub)}
        >
          100+ open-source components built with React, Tailwind CSS, and
          Motion. Live previews for you, a machine-readable registry for your
          agent.
        </motion.p>

        {/* CTA row */}
        <motion.div
          className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row"
          {...copyEntrance(DELAY.cta)}
        >
          {/* Override the component's transition-all duration-300 so the press
              snaps at 150ms instead of inheriting the slow hover timing */}
          <SlideTextButton
            className="transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]"
            hoverText="100+ live previews"
          />
          <button
            aria-label={isCopied ? "Copied" : "Copy the MCP setup command"}
            className="flex h-10 max-w-full items-center gap-2.5 rounded-lg border border-black/10 bg-black/[0.02] px-5 font-mono text-[13px] text-black/80 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-black/20 hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/80 dark:hover:border-white/20 dark:hover:bg-white/5"
            onClick={() => copyToClipboard(MCP_COMMAND)}
            type="button"
          >
            <span aria-hidden className="text-black/40 dark:text-white/40">
              $
            </span>
            <span className="truncate">{MCP_COMMAND}</span>
            {isCopied ? (
              <CheckIcon
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-green-500"
              />
            ) : (
              <CopyIcon
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-black/40 dark:text-white/40"
              />
            )}
          </button>
        </motion.div>
      </div>

      {/* Split panels */}
      <div className="relative mx-auto flex w-full max-w-[1080px] flex-col lg:flex-row">
        {/* Left: for humans */}
        <motion.div
          className="flex w-full flex-col gap-6 rounded-t-2xl border border-black/[0.08] bg-white p-6 md:p-8 lg:w-1/2 lg:rounded-l-2xl lg:rounded-tr-none lg:border-r-0 dark:border-white/[0.08] dark:bg-white/[0.02]"
          {...panelEntrance(DELAY.leftPanel)}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-[15px] text-black dark:text-white">
              For humans
            </h2>
            <span className="text-black/55 text-xs dark:text-white/55">
              live previews · copy-paste source
            </span>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none grid select-none grid-cols-1 gap-5 sm:grid-cols-2"
          >
            <div className={PREVIEW_TILE_CLASS}>
              <div className="relative rounded-lg bg-black px-4 py-2 font-medium text-[13px] text-white dark:bg-white dark:text-black">
                Click me
                <span className="absolute -top-1 -right-1.5 h-1 w-1 rounded-full bg-[#2CD242]" />
                <span className="absolute -top-2.5 right-2 h-[3px] w-[3px] rounded-full bg-black/30 dark:bg-white/40" />
                <span className="absolute -bottom-1.5 -left-1.5 h-[3px] w-[3px] rounded-full bg-black/30 dark:bg-white/40" />
              </div>
              <span className={PREVIEW_LABEL_CLASS}>particle-button</span>
            </div>
            <div className={PREVIEW_TILE_CLASS}>
              <div className="flex w-[132px] flex-col gap-2 rounded-[10px] border border-black/[0.08] bg-white p-3 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.15)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[0_8px_16px_-8px_rgba(0,0,0,0.6)]">
                <div className="h-2 w-3/5 rounded bg-black/15 dark:bg-white/20" />
                <div className="h-1.5 w-[90%] rounded bg-black/[0.07] dark:bg-white/10" />
                <div className="h-1.5 w-3/4 rounded bg-black/[0.07] dark:bg-white/10" />
              </div>
              <span className={PREVIEW_LABEL_CLASS}>liquid-glass-card</span>
            </div>
            <div className={PREVIEW_TILE_CLASS}>
              <span className="flex items-center gap-0.5 font-bold text-black/90 text-xl tracking-tight dark:text-white/90">
                Type
                <span className="h-5 w-[2px] bg-black/60 dark:bg-white/60" />
              </span>
              <span className={PREVIEW_LABEL_CLASS}>type-writer</span>
            </div>
            <div className={PREVIEW_TILE_CLASS}>
              <div className="flex w-36 items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/[0.04]">
                <span className="text-black/40 text-xs dark:text-white/40">
                  Ask anything…
                </span>
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black dark:bg-white">
                  <svg
                    className="h-2.5 w-2.5 text-white dark:text-black"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <title>Send</title>
                    <path d="M12 19V5M6 11l6-6 6 6" />
                  </svg>
                </span>
              </div>
              <span className={PREVIEW_LABEL_CLASS}>ai-prompt</span>
            </div>
          </div>
        </motion.div>

        {/* Right: for agents */}
        <motion.div
          className="flex w-full flex-col gap-6 rounded-b-2xl bg-[#0a0a0a] p-6 md:p-8 lg:w-1/2 lg:rounded-r-2xl lg:rounded-bl-none dark:border dark:border-white/[0.08] dark:border-l-0"
          {...panelEntrance(DELAY.rightPanel)}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-[15px] text-white">For agents</h2>
            <div className="flex items-center gap-3.5">
              <Claude className="h-4 w-4 text-white" />
              <OpenAIDark className="h-4 w-4" />
              <Gemini className="h-4 w-4" />
              <GrokDark className="h-4 w-4" />
              <CursorDark className="h-4 w-4" />
            </div>
          </div>
          <div className="flex grow flex-col justify-center gap-3 font-mono text-[13px]">
            {INSTALLED_ROWS.map((row, i) => (
              <motion.div
                className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.08] px-4 py-3"
                key={row.name}
                {...rowEntrance(DELAY.rowBase + i * DELAY.rowStep)}
              >
                <span className="truncate text-white/85">{row.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-white/50 text-xs tabular-nums">
                  <CheckIcon aria-hidden className="h-3 w-3 text-[#3BB44B]" />
                  installed · {row.time}
                </span>
              </motion.div>
            ))}
            <motion.div
              className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.16] bg-white/[0.04] px-4 py-3"
              {...rowEntrance(DELAY.rowBase + 3 * DELAY.rowStep)}
            >
              <span className="truncate text-white">@kokonutui/ai-prompt</span>
              {/* Both states share the same height so the swap doesn't shift the row */}
              {lastRowDone ? (
                <span className="flex shrink-0 items-center gap-2 text-white/60 text-xs tabular-nums">
                  <CheckIcon aria-hidden className="h-3 w-3 text-[#3BB44B]" />
                  installed · 1.1s
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-2 text-white/60 text-xs">
                  <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#3BB44B] motion-reduce:animate-none" />
                  resolving dependencies…
                </span>
              )}
            </motion.div>
          </div>
          <motion.div
            className="flex items-center justify-center gap-2.5 border-white/[0.08] border-t pt-5 text-white/55 text-xs"
            {...rowEntrance(DELAY.rowBase + 4 * DELAY.rowStep)}
          >
            <span>MCP</span>
            <span aria-hidden className="text-white/25">
              ·
            </span>
            <span>shadcn CLI</span>
            <span aria-hidden className="text-white/25">
              ·
            </span>
            <span>llms.txt</span>
          </motion.div>
        </motion.div>

        {/* Center node (desktop only — panels stack on mobile) */}
        <motion.div
          animate={mounted ? { opacity: 1, scale: 1 } : undefined}
          className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none lg:block"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          transition={{
            duration: DURATION.slow,
            delay: DELAY.node * scale,
            ease: EASE_EXPO_OUT,
          }}
        >
          <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)] dark:border-white/15 dark:bg-zinc-900 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]">
            <span className="font-bold text-black text-xs tracking-tight dark:text-white">
              same
            </span>
            <span className="font-bold text-black text-xs tracking-tight dark:text-white">
              registry
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
