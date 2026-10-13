"use client";

/**
 * @author: @dorianbaffier
 * @description: Scroll Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollTextProps {
  texts?: string[];
  className?: string;
}

// Module scope keeps the default array stable, so the observer effect below
// does not re-run on every render.
const DEFAULT_TEXTS = [
  "TailwindCSS",
  "Kokonut UI",
  "shadcn/ui",
  "Next.js",
  "Vercel",
  "Motion",
  "React",
  "Resend",
  "TypeScript",
  "Fumadocs",
  "Supabase",
];

export default function ScrollText({
  texts = DEFAULT_TEXTS,
  className,
}: ScrollTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to top on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  // Highlight the item crossing the middle band of the scroll container. This
  // runs in an effect because item refs attach before the container ref, so
  // `containerRef.current` is still null inside the item ref callbacks.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }

    const indexByItem = new Map<Element, number>();
    // The band is 10% of the container, shorter than an item, so any overlap
    // counts (a 0.7 ratio could never be reached).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = indexByItem.get(entry.target);
          if (entry.isIntersecting && index !== undefined) {
            setActiveIndex(index);
          }
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    const items = itemsRef.current.slice(0, texts.length);
    for (const [index, item] of items.entries()) {
      if (item) {
        indexByItem.set(item, index);
        observer.observe(item);
      }
    }

    return () => observer.disconnect();
  }, [texts]);

  // Animation variants for the reveal effect
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: (index: number) => ({
      opacity: 0,
      x: index % 2 === 0 ? -100 : 100,
      rotate: index % 2 === 0 ? -10 : 10,
    }),
    visible: {
      opacity: 1,
      x: 0,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.5,
      },
    },
  };

  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <div
        className={cn(
          "scrollbar-none h-[300px] overflow-y-auto",
          "relative flex flex-col items-center",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        ref={containerRef}
      >
        <div className="h-[150px]" />
        <motion.div
          animate="visible"
          className="flex w-full flex-col items-center"
          initial="hidden"
          variants={containerVariants}
        >
          {texts.map((text, index) => (
            <motion.div
              className={cn(
                "whitespace-nowrap px-4 py-8 font-bold text-5xl",
                "transition-colors duration-300",
                activeIndex === index
                  ? "text-black dark:text-white"
                  : "text-neutral-500/50 dark:text-neutral-600"
              )}
              custom={index}
              initial="hidden"
              key={`${index}-${text}`}
              ref={(el) => {
                itemsRef.current[index] = el;
              }}
              variants={itemVariants}
              viewport={{
                once: false,
                margin: "-20% 0px -20% 0px",
              }}
              whileInView="visible"
            >
              {text}
            </motion.div>
          ))}
        </motion.div>
        <div className="h-[150px]" />
      </div>
    </div>
  );
}
