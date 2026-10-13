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

import { MotionConfig, motion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", duration: 0.5, bounce: 0.15 },
  },
} satisfies Variants;

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

  return (
    <div className={cn("mx-auto h-[300px] w-full max-w-3xl", className)}>
      <div
        className={cn(
          "h-full overflow-y-auto overflow-x-hidden",
          "relative flex flex-col items-center",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        ref={containerRef}
      >
        {/* Half-height spacers let the first and last items reach the middle
            band. shrink-0 keeps flex from collapsing them to 0. */}
        <div className="h-1/2 shrink-0" />
        {/* Under reduced motion the rise is skipped and only the fade plays. */}
        <MotionConfig reducedMotion="user">
          {texts.map((text, index) => (
            <motion.div
              className={cn(
                "whitespace-nowrap px-4 py-8 font-bold text-5xl",
                "transition-colors duration-300",
                activeIndex === index
                  ? "text-black dark:text-white"
                  : "text-neutral-500/50 dark:text-neutral-600"
              )}
              initial="hidden"
              key={`${index}-${text}`}
              ref={(el) => {
                itemsRef.current[index] = el;
              }}
              variants={itemVariants}
              viewport={{
                once: true,
                margin: "-20% 0px -20% 0px",
              }}
              whileInView="visible"
            >
              {text}
            </motion.div>
          ))}
        </MotionConfig>
        <div className="h-1/2 shrink-0" />
      </div>
    </div>
  );
}
