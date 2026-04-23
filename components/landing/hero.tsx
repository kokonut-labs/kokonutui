"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import AILoadingState from "@/components/kokonutui/ai-loading";
import AI_Prompt from "@/components/kokonutui/ai-prompt";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { EASE_OUT } from "@/lib/animation-presets";
import { ArrowRightBroken } from "../icons/arrow-right-broken";
import CardFlip from "../kokonutui/card-flip";
import FileUpload from "../kokonutui/file-upload";
import NotificationCenter from "../kokonutui/liquid-glass-card";

const TILE_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 26,
  mass: 0.8,
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

const rowVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

function tileVariants(restingRotate: number): Variants {
  return {
    hidden: {
      opacity: 0,
      y: 28,
      filter: "blur(12px)",
      rotate: restingRotate,
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      rotate: restingRotate,
      transition: { duration: 0.55, ease: EASE_OUT },
    },
    hover: {
      rotate: 0,
      scale: 1.025,
      filter: "blur(0px)",
      transition: TILE_SPRING,
    },
  };
}

const reducedTileVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } },
  hover: {},
};

const copyVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

const reducedCopyVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } },
};

const tileStyle = { willChange: "transform, filter, opacity" } as const;

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const tile = (rest: number) =>
    reduceMotion ? reducedTileVariants : tileVariants(rest);
  const copy = reduceMotion ? reducedCopyVariants : copyVariants;

  return (
    <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-between gap-8 px-4 py-8 md:py-12 lg:flex-row lg:gap-4">
      {/* Left side - Title and CTA */}
      <motion.div
        animate="visible"
        className="flex w-full flex-col items-start space-y-8 text-left md:mb-28 lg:w-[45%]"
        initial="hidden"
        variants={containerVariants}
      >
        <motion.div variants={copy}>
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
          variants={copy}
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
        <motion.div className="mt-8 w-full space-y-2" variants={copy}>
          <div className="h-px w-full bg-linear-to-r from-zinc-950/5 via-zinc-950/50 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/50" />
          <div className="h-px w-[70%] bg-linear-to-r from-zinc-950/5 via-zinc-950/30 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/30" />
        </motion.div>
        <motion.div variants={copy}>
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
      </motion.div>

      {/* Right side - Tile grid. min-h reserves space so the column doesn't reflow
          while inner components (images, canvases) hydrate. */}
      <motion.div
        animate="visible"
        className="flex min-h-[560px] w-full flex-col justify-between gap-8 md:min-h-[640px] lg:w-[55%] lg:pl-8"
        initial="hidden"
        variants={containerVariants}
      >
        <motion.div
          className="relative grid w-full grid-cols-1 items-center justify-center gap-6 md:grid-cols-2"
          variants={rowVariants}
        >
          <motion.div
            className="flex w-full flex-col items-center justify-center"
            style={tileStyle}
            variants={tile(-5)}
            whileHover="hover"
          >
            <FileUpload />
          </motion.div>

          <motion.div
            className="w-full"
            style={tileStyle}
            variants={tile(3)}
            whileHover="hover"
          >
            <CardFlip />
          </motion.div>
        </motion.div>

        <motion.div
          className="-mt-4 flex w-full flex-col items-center justify-center md:mt-0"
          style={tileStyle}
          variants={tile(-2)}
          whileHover="hover"
        >
          <AI_Prompt />
        </motion.div>

        <motion.div
          className="relative -mt-4 grid w-full grid-cols-1 gap-6 md:mt-0 md:grid-cols-2"
          variants={rowVariants}
        >
          <motion.div
            className="w-full"
            style={tileStyle}
            variants={tile(-4)}
            whileHover="hover"
          >
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <AILoadingState />
            </div>
          </motion.div>

          <motion.div
            className="w-full"
            style={tileStyle}
            variants={tile(4)}
            whileHover="hover"
          >
            <NotificationCenter />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
