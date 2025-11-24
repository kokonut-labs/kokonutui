"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import AILoadingState from "@/components/kokonutui/ai-loading";
import AI_Prompt from "@/components/kokonutui/ai-prompt";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import CardFlip from "../kokonutui/card-flip";
import FileUpload from "../kokonutui/file-upload";
import NotificationCenter from "../kokonutui/liquid-glass-card";
import FeatureBlock from "./feature-block";

export function HeroSection() {
  return (
    <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-between gap-8 px-4 py-8 md:py-12 lg:flex-row lg:gap-4">
      {/* Left side - Title and CTA */}
      <div className="flex w-full flex-col items-start space-y-8 text-start md:mb-28 lg:w-[45%]">
        <div>
          <Link
            className="group relative mb-6 inline-flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
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
              Introducing Sonae template
            </span>
            <svg
              className="relative h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <title>Arrow Right</title>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <h1 className="font-bold text-5xl text-black leading-[1.1] tracking-tight sm:text-6xl lg:text-6xl dark:text-white">
            {/* Collection of stunning components */}
            Collection of stunning Components
          </h1>
          <p className="mt-6 max-w-lg text-base text-black/90 tracking-tighter md:text-xl dark:text-white/80">
            100+ Beautiful, modern UI components built with Tailwind CSS,
            shadcn/ui, and Motion to use on your Websites.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center sm:justify-start">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:items-start sm:justify-start">
            <SlideTextButton hoverText="Click to see more" />
            <SlideTextButton
              hoverText="Click to see more"
              href="https://kokonutui.pro/templates"
              text="View Templates"
              variant="ghost"
            />
          </div>
        </div>
        <FeatureBlock />
        <div className="mt-8 w-full space-y-2">
          <div className="h-[1px] w-full bg-gradient-to-r from-zinc-950/5 via-zinc-950/50 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/50" />
          <div className="h-[1px] w-[70%] bg-gradient-to-r from-zinc-950/5 via-zinc-950/30 to-transparent dark:from-zinc-50/5 dark:via-zinc-50/30" />
        </div>
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
      </div>

      <div className="flex w-full flex-col justify-between gap-8 lg:w-[55%] lg:pl-8">
        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative grid w-full grid-cols-1 items-center justify-center gap-6 md:grid-cols-2"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="flex w-full flex-col items-center justify-center"
            initial={{ rotate: -5 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            whileHover={{ rotate: 0, scale: 1.02 }}
          >
            <FileUpload />
          </motion.div>

          <motion.div
            className="w-full"
            initial={{ rotate: 3, y: 20 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            whileHover={{ rotate: 0, y: 0, scale: 1.02 }}
          >
            <CardFlip />
          </motion.div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="-mt-4 flex w-full flex-col items-center justify-center md:mt-0"
          initial={{ opacity: 0, scale: 1, rotate: -2 }}
          transition={{
            duration: 0.5,
            delay: 0.2,
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
          whileHover={{ rotate: 0, scale: 1.02 }}
        >
          <AI_Prompt />
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="-mt-4 relative grid w-full grid-cols-1 gap-6 md:mt-0 md:grid-cols-2"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Left side - Buttons */}
          <motion.div
            className="w-full"
            initial={{ rotate: -4, x: -10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            whileHover={{ rotate: 0, x: 0, scale: 1.02 }}
          >
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <AILoadingState />
            </div>
          </motion.div>

          {/* Right side - Input */}
          <motion.div
            className="w-full"
            initial={{ rotate: 4, x: 10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            whileHover={{ rotate: 0, x: 0, scale: 1.02 }}
          >
            {/* <AppleActivityCard title="" /> */}
            <NotificationCenter />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
