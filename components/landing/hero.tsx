"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import AILoadingState from "@/components/kokonutui/ai-loading";
import AI_Prompt from "@/components/kokonutui/ai-prompt";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { EASE_EXPO_OUT } from "@/lib/animation-presets";
import { ArrowRightBroken } from "../icons/arrow-right-broken";
import CardFlip from "../kokonutui/card-flip";
import FileUpload from "../kokonutui/file-upload";
import NotificationCenter from "../kokonutui/liquid-glass-card";

const ENTRANCE_DURATION = 0.34;
const REDUCED_DURATION = 0.18;
const COPY_Y = 8;
const TILE_Y = 12;

const TILE_HOVER_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 26,
  mass: 0.8,
};

// Single diagonal cascade across both columns. Top-left first, bottom-right
// last. Tuned so the whole sequence reads as one gesture under ~750ms.
const DELAY = {
  eyebrow: 0,
  heading: 0.04,
  buttons: 0.09,
  tileFileUpload: 0.14,
  tileCardFlip: 0.18,
  tileAiPrompt: 0.22,
  tileAiLoading: 0.26,
  tileNotification: 0.3,
  divider: 0.34,
  badge: 0.38,
} as const;

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  // Gate the entrance by one frame so child components can run their own
  // internal mount animations behind opacity:0 before we reveal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const duration = reduceMotion ? REDUCED_DURATION : ENTRANCE_DURATION;
  const scale = reduceMotion ? 0.5 : 1;

  const copyHidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: COPY_Y, filter: "blur(6px)" };
  const copyVisible = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" };

  const copyEntrance = (delay: number) => ({
    initial: copyHidden,
    animate: mounted ? copyVisible : undefined,
    transition: {
      duration,
      delay: delay * scale,
      ease: EASE_EXPO_OUT,
    },
  });

  const tileEntrance = (delay: number, restingRotate: number) => {
    const hidden = reduceMotion
      ? { opacity: 0, rotate: restingRotate }
      : { opacity: 0, y: TILE_Y, rotate: restingRotate };
    const visible = reduceMotion
      ? { opacity: 1, rotate: restingRotate }
      : { opacity: 1, y: 0, rotate: restingRotate };
    return {
      initial: hidden,
      animate: mounted ? visible : undefined,
      transition: {
        duration,
        delay: delay * scale,
        ease: EASE_EXPO_OUT,
      },
    };
  };

  const tileHover = reduceMotion
    ? undefined
    : { rotate: 0, scale: 1.025, transition: TILE_HOVER_SPRING };

  const tileStyle = { willChange: "transform, opacity" } as const;

  return (
    <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-between gap-8 px-4 py-8 md:py-12 lg:flex-row lg:gap-4">
      {/* Left side - Title and CTA */}
      <div className="flex w-full flex-col items-start space-y-8 text-left md:mb-28 lg:w-[45%]">
        <motion.div {...copyEntrance(DELAY.eyebrow)}>
          <Link
            className="group relative mb-6 inline-flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
            href="https://kokonutui.pro/templates"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              fill="none"
              height="100%"
              preserveAspectRatio="none"
              width="100%"
            >
              <title>Arrow Right</title>
              <rect
                className="animate-border-trace stroke-zinc-300 dark:stroke-zinc-600"
                fill="none"
                height="calc(100% - 1px)"
                rx="8"
                strokeDasharray="1000"
                strokeDashoffset="1000"
                strokeWidth="1"
                width="calc(100% - 1px)"
                x="0.5"
                y="0.5"
              />
            </svg>
            <span className="relative font-medium">
              Introducing Agenta template
            </span>
            <ArrowRightBroken className="h-4 w-4 rotate-[270deg] text-zinc-600 dark:text-zinc-400" />
          </Link>
        </motion.div>
        <motion.div {...copyEntrance(DELAY.heading)}>
          <h1 className="font-bold text-5xl text-black leading-[1.1] tracking-tight sm:text-6xl lg:text-6xl dark:text-white">
            Collection of stunning Components
          </h1>
          <p className="mt-6 max-w-lg text-base text-black/90 tracking-tighter md:text-xl dark:text-white/80">
            100+ Beautiful, modern UI components built with Tailwind CSS,
            shadcn/ui, and Motion to use on your Websites.
          </p>
        </motion.div>
        <motion.div
          className="flex w-full flex-col justify-center sm:justify-start"
          {...copyEntrance(DELAY.buttons)}
        >
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:items-start sm:justify-start">
            <SlideTextButton hoverText="Click to see more" />
            <SlideTextButton
              hoverText="Click to see more"
              href="https://kokonutui.pro/templates"
              text="View Templates"
              variant="ghost"
            />
          </div>
        </motion.div>
        <motion.div
          className="mt-8 w-full space-y-2"
          {...copyEntrance(DELAY.divider)}
        >
          <div className="h-px w-full bg-linear-to-r from-zinc-950/5 via-zinc-950/50 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/50" />
          <div className="h-px w-[70%] bg-linear-to-r from-zinc-950/5 via-zinc-950/30 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/30" />
        </motion.div>
        <motion.div {...copyEntrance(DELAY.badge)}>
          <Link
            className="group my-1 mt-2 mb-4 flex items-center gap-1.5 text-gray-600 text-xs transition-colors hover:cursor-pointer hover:font-medium hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
            href="https://vercel.com/blog/spring25-oss-program#kokonutui"
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex items-center gap-2">
              <Image
                alt="Vercel OSS Program"
                className="object-cover"
                height={256}
                src="https://vercel.com/oss/program-badge.svg"
                width={256}
              />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* Right side - Tile grid. min-h reserves space so the column doesn't reflow
          while inner components (images, canvases) hydrate. */}
      <div className="flex min-h-[600px] w-full flex-col justify-between gap-8 md:min-h-[680px] lg:w-[55%] lg:pl-8">
        <div className="relative grid w-full grid-cols-1 items-center justify-center gap-6 md:grid-cols-2">
          <motion.div
            className="flex w-full flex-col items-center justify-center"
            style={tileStyle}
            whileHover={tileHover}
            {...tileEntrance(DELAY.tileFileUpload, -5)}
          >
            <FileUpload />
          </motion.div>

          <motion.div
            className="w-full"
            style={tileStyle}
            whileHover={tileHover}
            {...tileEntrance(DELAY.tileCardFlip, 3)}
          >
            <CardFlip />
          </motion.div>
        </div>

        <motion.div
          className="-mt-4 flex w-full flex-col items-center justify-center md:mt-0"
          style={tileStyle}
          whileHover={tileHover}
          {...tileEntrance(DELAY.tileAiPrompt, -2)}
        >
          <AI_Prompt />
        </motion.div>

        <div className="relative -mt-4 grid w-full grid-cols-1 gap-6 md:mt-0 md:grid-cols-2">
          <motion.div
            className="w-full"
            style={tileStyle}
            whileHover={tileHover}
            {...tileEntrance(DELAY.tileAiLoading, -4)}
          >
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <AILoadingState />
            </div>
          </motion.div>

          <motion.div
            className="w-full"
            style={tileStyle}
            whileHover={tileHover}
            {...tileEntrance(DELAY.tileNotification, 4)}
          >
            <NotificationCenter />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
