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
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface LetterState {
  char: string;
  isMatrix: boolean;
  isSpace: boolean;
}

// Stable empty value, so resetting an already-idle animation does not re-render.
const NO_MATRIX_CHARS: ReadonlyMap<number, string> = new Map();

const getRandomChar = () => (Math.random() > 0.5 ? "1" : "0");

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
  // Binary characters currently shown in place of the letter at each index.
  const [matrixChars, setMatrixChars] = useState(NO_MATRIX_CHARS);

  const letters: LetterState[] = text.split("").map((char, index) => {
    const matrixChar = matrixChars.get(index);
    return {
      char: matrixChar ?? char,
      isMatrix: matrixChar !== undefined,
      isSpace: char === " ",
    };
  });

  // Restart whenever `text` or the timings change, and cancel every pending
  // timer on cleanup so nothing updates state after unmount.
  useEffect(() => {
    setMatrixChars(NO_MATRIX_CHARS);

    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const schedule = (callback: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        timeouts.delete(timeout);
        callback();
      }, delay);
      timeouts.add(timeout);
    };

    const animateLetter = (index: number) => {
      if (text[index] === " ") {
        return;
      }

      const matrixChar = getRandomChar();
      setMatrixChars((prev) => new Map(prev).set(index, matrixChar));
      schedule(() => {
        setMatrixChars((prev) => {
          const next = new Map(prev);
          next.delete(index);
          return next;
        });
      }, letterAnimationDuration);
    };

    let currentIndex = 0;
    const animate = () => {
      if (currentIndex >= text.length) {
        return;
      }

      animateLetter(currentIndex);
      currentIndex++;
      schedule(animate, letterInterval);
    };

    schedule(animate, initialDelay);

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [text, initialDelay, letterAnimationDuration, letterInterval]);

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
