"use client";

/**
 * @author: @kokonutui
 * @description: AI Text Loading
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const swapVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE_OUT } },
} satisfies Variants;

export default function AITextLoading({
  texts = [
    "Thinking...",
    "Processing...",
    "Analyzing...",
    "Computing...",
    "Almost...",
  ],
  className,
  interval = 1500,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  // Shared by every word so the shimmer keeps sweeping across word swaps
  // instead of restarting on each keyed element.
  const backgroundPosition = useMotionValue("200% center");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, texts.length]);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }
    const controls = animate(
      backgroundPosition,
      ["200% center", "-200% center"],
      { duration: 2.5, ease: "linear", repeat: Number.POSITIVE_INFINITY }
    );
    return () => controls.stop();
  }, [backgroundPosition, shouldReduceMotion]);

  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold text-3xl",
        className
      )}
    >
      {/* With reduced motion the words swap with a fade only, no slide. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          <motion.div
            animate="animate"
            className="flex min-w-max justify-center whitespace-nowrap bg-[length:200%_100%] bg-gradient-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text text-transparent dark:from-white dark:via-neutral-600 dark:to-white"
            exit="exit"
            initial="initial"
            key={currentTextIndex}
            style={{ backgroundPosition }}
            variants={swapVariants}
          >
            {texts[currentTextIndex]}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
