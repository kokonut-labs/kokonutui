"use client";

/**
 * @author: @dorianbaffier
 * @description: Typewriter
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface TypewriterSequence {
  text: string;
  deleteAfter?: boolean;
  pauseAfter?: number;
}

interface TypewriterTitleProps {
  sequences?: TypewriterSequence[];
  typingSpeed?: number;
  startDelay?: number;
  autoLoop?: boolean;
  loopDelay?: number;
  deleteSpeed?: number;
  pauseBeforeDelete?: number;
  naturalVariance?: boolean;
}

const DEFAULT_SEQUENCES: TypewriterSequence[] = [
  { text: "Typewriter", deleteAfter: true },
  { text: "Multiple Words", deleteAfter: true },
  { text: "Auto Loop", deleteAfter: false },
];

const NEXT_SEQUENCE_DELAY = 100;

// The caret blink is a CSS animation so it runs off the main thread: solid
// for the first third of the cycle, fades out, then stays hidden.
const CARET_KEYFRAMES =
  "@keyframes kokonutui-typewriter-caret { 0%, 33.333% { opacity: 1; } 66.667%, 100% { opacity: 0; } }";

function getTypingDelay(typingSpeed: number, naturalVariance: boolean) {
  if (!naturalVariance) {
    return typingSpeed;
  }

  const random = Math.random();

  // 10% chance of a hesitation, 10% chance of a burst.
  if (random < 0.1) {
    return typingSpeed * 2;
  }
  if (random > 0.9) {
    return typingSpeed * 0.5;
  }

  // Otherwise +/- 40%.
  const variance = 0.4;
  const min = typingSpeed * (1 - variance);
  const max = typingSpeed * (1 + variance);
  return Math.random() * (max - min) + min;
}

export default function TypewriterTitle({
  sequences = DEFAULT_SEQUENCES,
  typingSpeed = 50,
  startDelay = 200,
  autoLoop = true,
  loopDelay = 1000,
  deleteSpeed = 30,
  pauseBeforeDelete = 1000,
  naturalVariance = true,
}: TypewriterTitleProps) {
  const [displayText, setDisplayText] = useState("");
  const sequenceIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const sequencesRef = useRef(sequences);
  useEffect(() => {
    sequencesRef.current = sequences;
  }, [sequences]);

  useEffect(() => {
    // Reduced motion: show the final phrase, no typing loop.
    if (shouldReduceMotion) {
      setDisplayText(sequencesRef.current.at(-1)?.text ?? "");
      return;
    }

    function schedule(callback: () => void, delay: number) {
      timeoutRef.current = setTimeout(callback, delay);
    }

    function goToNextSequence(delay: number) {
      const isLastSequence =
        sequenceIndexRef.current === sequencesRef.current.length - 1;
      if (isLastSequence && !autoLoop) {
        return;
      }

      schedule(
        () => {
          sequenceIndexRef.current = isLastSequence
            ? 0
            : sequenceIndexRef.current + 1;
          charIndexRef.current = 0;
          setDisplayText("");
          runTypewriter();
        },
        isLastSequence ? loopDelay : delay
      );
    }

    function deleteStep(text: string) {
      if (charIndexRef.current > 0) {
        charIndexRef.current -= 1;
        setDisplayText(text.slice(0, charIndexRef.current));
        schedule(runTypewriter, deleteSpeed);
        return;
      }

      isDeletingRef.current = false;
      goToNextSequence(NEXT_SEQUENCE_DELAY);
    }

    function typeStep(sequence: TypewriterSequence) {
      if (charIndexRef.current < sequence.text.length) {
        charIndexRef.current += 1;
        setDisplayText(sequence.text.slice(0, charIndexRef.current));
        schedule(runTypewriter, getTypingDelay(typingSpeed, naturalVariance));
        return;
      }

      const pauseDuration = sequence.pauseAfter ?? pauseBeforeDelete;
      if (sequence.deleteAfter) {
        schedule(() => {
          isDeletingRef.current = true;
          runTypewriter();
        }, pauseDuration);
        return;
      }

      goToNextSequence(pauseDuration);
    }

    function runTypewriter() {
      const currentSequence = sequencesRef.current[sequenceIndexRef.current];
      if (!currentSequence) {
        return;
      }

      if (isDeletingRef.current) {
        deleteStep(currentSequence.text);
      } else {
        typeStep(currentSequence);
      }
    }

    schedule(runTypewriter, startDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    // Only restart effect if timing configs change.
    // We use sequencesRef for content to avoid restarting on array reference change.
    typingSpeed,
    deleteSpeed,
    pauseBeforeDelete,
    autoLoop,
    loopDelay,
    startDelay,
    naturalVariance,
    shouldReduceMotion,
  ]);

  return (
    <div className="relative mx-auto w-full max-w-4xl py-24">
      <style href="kokonutui-type-writer" precedence="default">
        {CARET_KEYFRAMES}
      </style>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <motion.div
          animate={{ opacity: 1 }}
          className="flex items-center gap-1 font-mono text-4xl text-black tracking-tight md:text-6xl dark:text-white"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Screen readers get every phrase once instead of whatever
              partial string is on screen. */}
          <span className="sr-only">
            {sequences.map((sequence) => sequence.text).join(", ")}
          </span>
          <span
            aria-hidden="true"
            className="inline-block min-h-[1.2em] min-w-[0.5em]"
          >
            {displayText}
          </span>
          <span
            aria-hidden="true"
            className="inline-block h-[1em] w-[3px] bg-black motion-safe:animate-[kokonutui-typewriter-caret_1s_linear_infinite] dark:bg-white"
          />
        </motion.div>
      </div>
    </div>
  );
}
