"use client";

/**
 * @author: @dorianbaffier
 * @description: Matrix Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface LetterState {
  char: string;
  isMatrix: boolean;
  isSpace: boolean;
}

interface MatrixTextProps {
  text?: string;
  className?: string;
  initialDelay?: number;
  letterAnimationDuration?: number;
  letterInterval?: number;
}

const MatrixText = ({
  text = "HelloWorld!",
  className,
  initialDelay = 200,
  letterAnimationDuration = 500,
  letterInterval = 100,
}: MatrixTextProps) => {
  const [letters, setLetters] = useState<LetterState[]>(() =>
    text.split("").map((char) => ({
      char,
      isMatrix: false,
      isSpace: char === " ",
    }))
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const getRandomChar = useCallback(
    () => (Math.random() > 0.5 ? "1" : "0"),
    []
  );

  const animateLetter = useCallback(
    (index: number) => {
      if (index >= text.length) return;

      requestAnimationFrame(() => {
        setLetters((prev) => {
          const newLetters = [...prev];
          if (!newLetters[index].isSpace) {
            newLetters[index] = {
              ...newLetters[index],
              char: getRandomChar(),
              isMatrix: true,
            };
          }
          return newLetters;
        });

        setTimeout(() => {
          setLetters((prev) => {
            const newLetters = [...prev];
            newLetters[index] = {
              ...newLetters[index],
              char: text[index],
              isMatrix: false,
            };
            return newLetters;
          });
        }, letterAnimationDuration);
      });
    },
    [getRandomChar, text, letterAnimationDuration]
  );

  const startAnimation = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    let currentIndex = 0;

    const animate = () => {
      if (currentIndex >= text.length) {
        setIsAnimating(false);
        return;
      }

      animateLetter(currentIndex);
      currentIndex++;
      setTimeout(animate, letterInterval);
    };

    animate();
  }, [animateLetter, text, isAnimating, letterInterval]);

  useEffect(() => {
    const timer = setTimeout(startAnimation, initialDelay);
    return () => clearTimeout(timer);
  }, []);

  const motionVariants = useMemo(
    () => ({
      matrix: {
        color: "#00ff00",
        textShadow: "0 2px 4px rgba(0, 255, 0, 0.5)",
      },
    }),
    []
  );

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center text-black dark:text-white",
        className
      )}
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden="true" className="flex h-24 items-center justify-center">
        <div className="flex flex-wrap items-center justify-center motion-reduce:hidden">
          {letters.map((letter, index) => (
            <motion.div
              animate={letter.isMatrix ? "matrix" : "normal"}
              className="w-[1ch] overflow-hidden text-center font-mono text-4xl md:text-6xl"
              initial="initial"
              key={`${index}-${letter.char}`}
              transition={{
                duration: 0.1,
                ease: "easeInOut",
              }}
              variants={motionVariants}
            >
              {letter.isSpace ? "\u00A0" : letter.char}
            </motion.div>
          ))}
        </div>
        {/* Reduced motion shows the final text instead of the glyph flicker. */}
        <div className="hidden whitespace-pre-wrap text-center font-mono text-4xl motion-reduce:block md:text-6xl">
          {text}
        </div>
      </div>
    </div>
  );
};

export default MatrixText;
