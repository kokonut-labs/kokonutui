"use client";

/**
 * @author: @dorianbaffier
 * @description: Shape Hero
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { Pacifico } from "next/font/google";
import { cn } from "@/lib/utils";

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
});

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.06,
      ease: EASE_OUT,
    },
  }),
} satisfies Variants;

interface ElegantShapeProps {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
  borderRadius?: number;
  float?: boolean;
}

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
  borderRadius = 16,
  float = true,
}: ElegantShapeProps) {
  return (
    <motion.div
      animate={{
        opacity: 1,
        y: 0,
        rotate,
      }}
      className={cn("absolute", className)}
      initial={{
        opacity: 0,
        y: -40,
        rotate: rotate - 15,
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
      }}
    >
      {/* A full `transform` string (not `y`) lets Motion run the loop on the compositor. */}
      <motion.div
        animate={
          float
            ? {
                transform: [
                  "translateY(0px)",
                  "translateY(15px)",
                  "translateY(0px)",
                ],
              }
            : undefined
        }
        className="relative"
        style={{
          width,
          height,
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        <div
          className={cn(
            "absolute inset-0",
            "bg-linear-to-r to-transparent",
            gradient,
            "ring-1 ring-white/[0.03] dark:ring-white/[0.02]",
            "shadow-[0_2px_16px_-2px_rgba(255,255,255,0.04)]",
            "after:absolute after:inset-0",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)]",
            "after:rounded-[inherit]"
          )}
          style={{ borderRadius }}
        />
      </motion.div>
    </motion.div>
  );
}

const SHAPES: (ElegantShapeProps & { id: string })[] = [
  {
    id: "tall-top-left",
    borderRadius: 24,
    className: "top-[-10%] left-[-15%]",
    delay: 0.3,
    gradient: "from-indigo-500/25 dark:from-indigo-500/35",
    height: 500,
    rotate: -8,
    width: 300,
  },
  {
    id: "wide-bottom-right",
    borderRadius: 20,
    className: "right-[-20%] bottom-[-5%]",
    delay: 0.5,
    gradient: "from-rose-500/25 dark:from-rose-500/35",
    height: 200,
    rotate: 15,
    width: 600,
  },
  {
    id: "square-middle-left",
    borderRadius: 32,
    className: "top-[40%] left-[-5%]",
    delay: 0.4,
    gradient: "from-violet-500/25 dark:from-violet-500/35",
    height: 300,
    rotate: 24,
    width: 300,
  },
  {
    id: "small-top-right",
    borderRadius: 12,
    className: "top-[5%] right-[10%]",
    delay: 0.6,
    gradient: "from-amber-500/25 dark:from-amber-500/35",
    height: 100,
    rotate: -20,
    width: 250,
  },
  {
    id: "medium-center-right",
    borderRadius: 16,
    className: "top-[45%] right-[-10%]",
    delay: 0.7,
    gradient: "from-emerald-500/25 dark:from-emerald-500/35",
    height: 150,
    rotate: 35,
    width: 400,
  },
  {
    id: "small-square-bottom-left",
    borderRadius: 28,
    className: "bottom-[10%] left-[20%]",
    delay: 0.2,
    gradient: "from-blue-500/25 dark:from-blue-500/35",
    height: 200,
    rotate: -25,
    width: 200,
  },
  {
    id: "tiny-top-center",
    borderRadius: 10,
    className: "top-[15%] left-[40%]",
    delay: 0.8,
    gradient: "from-purple-500/25 dark:from-purple-500/35",
    height: 80,
    rotate: 45,
    width: 150,
  },
  {
    id: "wide-middle",
    borderRadius: 18,
    className: "top-[60%] left-[25%]",
    delay: 0.9,
    gradient: "from-teal-500/25 dark:from-teal-500/35",
    height: 120,
    rotate: -12,
    width: 450,
  },
];

export default function ShapeHero({
  title1 = "Elevate Your",
  title2 = "Digital Vision",
}: {
  title1?: string;
  title2?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    // reducedMotion="user" turns the drop-in and text slide into opacity-only fades.
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white dark:bg-[#030303]">
        <div className="absolute inset-0 bg-linear-to-br from-indigo-500/[0.02] via-transparent to-rose-500/[0.02] dark:from-indigo-500/[0.05] dark:via-transparent dark:to-rose-500/[0.05]" />

        <div className="absolute inset-0 overflow-hidden">
          {SHAPES.map(({ id, ...shape }) => (
            <ElegantShape float={!shouldReduceMotion} key={id} {...shape} />
          ))}
        </div>

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              animate="visible"
              custom={1}
              initial="hidden"
              variants={fadeUpVariants}
            >
              <h1 className="mb-6 font-bold text-4xl tracking-tight sm:text-6xl md:mb-8 md:text-8xl">
                <span className="bg-linear-to-b from-black to-black/80 bg-clip-text text-transparent dark:from-white dark:to-white/80">
                  {title1}
                </span>
                <br />
                <span
                  className={cn(
                    "bg-linear-to-r from-indigo-300 via-black/90 to-rose-300 bg-clip-text text-transparent dark:from-indigo-300 dark:via-white/90 dark:to-rose-300",
                    pacifico.className
                  )}
                >
                  {title2}
                </span>
              </h1>
            </motion.div>
            <motion.div
              animate="visible"
              custom={2}
              initial="hidden"
              variants={fadeUpVariants}
            >
              <p className="mx-auto mb-8 max-w-xl px-4 font-light text-base text-black/40 leading-relaxed tracking-wide sm:text-lg md:text-xl dark:text-white/40">
                UI Components built with Tailwind CSS.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white via-transparent to-white/80 dark:from-[#030303] dark:via-transparent dark:to-[#030303]/80" />
      </div>
    </MotionConfig>
  );
}
