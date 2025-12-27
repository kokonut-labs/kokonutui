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
    "Turborepo",
  ],
  className,
}: ScrollTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to top on mount
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
              key={text}
              ref={(el) => setupObserver(el, index)}
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
