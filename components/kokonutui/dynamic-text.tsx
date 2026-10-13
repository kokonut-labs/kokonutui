"use client";

/**
 * @author: @dorianbaffier
 * @description: Dynamic Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";

interface Greeting {
  text: string;
  /** BCP 47 language tag, so screen readers pronounce each word correctly. */
  lang: string;
}

const greetings: Greeting[] = [
  { text: "Hello", lang: "en" },
  { text: "こんにちは", lang: "ja" },
  { text: "Bonjour", lang: "fr" },
  { text: "Hola", lang: "es" },
  { text: "안녕하세요", lang: "ko" },
  { text: "Ciao", lang: "it" },
  { text: "Hallo", lang: "de" },
  { text: "こんにちは", lang: "ja" },
];

const LAST_INDEX = greetings.length - 1;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DynamicText = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDone = currentIndex === LAST_INDEX;

  useEffect(() => {
    if (isDone) {
      return;
    }
    const interval = setInterval(() => {
      setCurrentIndex((index) => Math.min(index + 1, LAST_INDEX));
    }, 300);
    return () => clearInterval(interval);
  }, [isDone]);

  const greeting = greetings[currentIndex];

  return (
    <section
      aria-label="Rapid greetings in different languages"
      className="flex min-h-[200px] items-center justify-center gap-1 p-4"
    >
      <div className="relative flex h-16 w-60 items-center justify-center">
        {/* Reduced motion keeps the crossfade and drops the slide. */}
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="popLayout">
            <motion.div
              animate={{
                y: 0,
                opacity: 1,
                transition: { duration: 0.2, ease: EASE_OUT },
              }}
              aria-live="off"
              className="absolute flex items-center gap-2 font-medium text-2xl text-gray-800 dark:text-gray-200"
              exit={{
                y: -8,
                opacity: 0,
                transition: { duration: 0.15, ease: EASE_OUT },
              }}
              initial={{ y: 8, opacity: 0 }}
              key={currentIndex}
              lang={greeting.lang}
            >
              <div
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-black dark:bg-white"
              />
              {greeting.text}
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      </div>
    </section>
  );
};

export default DynamicText;
