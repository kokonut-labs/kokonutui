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
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Greeting {
  text: string;
  /** BCP 47 language tag, so screen readers pronounce each word correctly. */
  lang?: string;
}

interface DynamicTextProps {
  /** Words to show in turn. Defaults to the greetings demo. */
  words?: Greeting[];
  /** Milliseconds between words. */
  interval?: number;
  /** Start over after the last word instead of stopping on it. */
  loop?: boolean;
  /** Called once the last word is shown. Never called when looping. */
  onComplete?: () => void;
  className?: string;
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

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DynamicText = ({
  words = greetings,
  interval = 300,
  loop = false,
  onComplete,
  className,
}: DynamicTextProps) => {
  // Counts every advance, so a looping word gets a fresh key each time.
  const [step, setStep] = useState(0);
  const count = words.length;
  const lastIndex = count - 1;
  const isDone = !loop && step >= lastIndex;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (isDone || count < 2) {
      return;
    }
    const id = setInterval(() => {
      setStep((current) => current + 1);
    }, interval);
    return () => clearInterval(id);
  }, [isDone, count, interval]);

  useEffect(() => {
    if (isDone) {
      onCompleteRef.current?.();
    }
  }, [isDone]);

  const greeting = words[loop ? step % count : Math.min(step, lastIndex)];
  if (!greeting) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-h-[200px] items-center justify-center gap-1 p-4",
        className
      )}
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
              key={step}
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
    </div>
  );
};

export default DynamicText;
