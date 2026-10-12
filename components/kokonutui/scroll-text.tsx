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

export default function ScrollText({
  texts = [
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
    "Vercel",
  ],
  className,
}: ScrollTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = itemsRef.current.findIndex(
          (item) => item === entry.target
        );
        setActiveIndex(index);
      }
    });
  };

  // Setup intersection observer
  const setupObserver = (element: HTMLDivElement | null, index: number) => {
    if (element && !itemsRef.current[index]) {
      itemsRef.current[index] = element;

      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(handleIntersection, {
          threshold: 0.7,
          root: containerRef.current,
          rootMargin: "-45% 0px -45% 0px",
        });
      }

      observerRef.current.observe(element);
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <div
        className={cn(
          "h-[300px] overflow-y-auto",
          "relative flex flex-col items-center",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        ref={containerRef}
      >
        <div className="h-[150px]" />
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
              key={text}
              ref={(el) => setupObserver(el, index)}
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
        <div className="h-[150px]" />
      </div>
    </div>
  );
}
