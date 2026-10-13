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

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TypewriterSequence {
  text: string;
  deleteAfter?: boolean;
  pauseAfter?: number;
}

type TypewriterElement = "div" | "p" | "span" | "h1" | "h2" | "h3";

interface TypewriterTitleProps {
  sequences?: TypewriterSequence[];
  typingSpeed?: number;
  startDelay?: number;
  autoLoop?: boolean;
  loopDelay?: number;
  deleteSpeed?: number;
  pauseBeforeDelete?: number;
  naturalVariance?: boolean;
  /**
   * Stops the typing where it is. Wire it to a pause control to let users
   * stop the endless loop (WCAG 2.2.2). It also pauses while off screen.
   */
  paused?: boolean;
  /** Element to render, e.g. `h1` when it is the page title. */
  as?: TypewriterElement;
  className?: string;
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
  paused = false,
  as: Component = "div",
  className,
}: TypewriterTitleProps) {
  const [displayText, setDisplayText] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref);
  const isRunning = !paused && isInView;
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
    // Paused or off screen: keep the current text. The refs remember the
    // position, so typing resumes where it stopped.
    if (!isRunning) {
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

      // Advance now, so pausing during the wait cannot retype this phrase.
      sequenceIndexRef.current = isLastSequence
        ? 0
        : sequenceIndexRef.current + 1;
      charIndexRef.current = 0;
      schedule(
        () => {
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
      const isLastSequence =
        sequenceIndexRef.current === sequencesRef.current.length - 1;
      // Looping deletes the last phrase too, instead of it vanishing.
      if (sequence.deleteAfter || (isLastSequence && autoLoop)) {
        schedule(() => {
          isDeletingRef.current = true;
          runTypewriter();
        }, pauseDuration);
        return;
      }

      goToNextSequence(pauseDuration);
    }

    function runTypewriter() {
      // `sequences` may have shrunk past the current phrase: start over.
      if (sequenceIndexRef.current >= sequencesRef.current.length) {
        sequenceIndexRef.current = 0;
        charIndexRef.current = 0;
        isDeletingRef.current = false;
      }
      const currentSequence = sequencesRef.current[sequenceIndexRef.current];
      if (!currentSequence) {
        return;
      }
      charIndexRef.current = Math.min(
        charIndexRef.current,
        currentSequence.text.length
      );

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
    isRunning,
  ]);

  // An invisible copy of the longest phrase reserves the width, so the text
  // grows from a fixed left edge instead of re-centering on every keystroke.
  const longestText = sequences.reduce(
    (longest, sequence) =>
      sequence.text.length > longest.length ? sequence.text : longest,
    ""
  );

  return (
    <Component
      className={cn(
        "flex items-center justify-center font-mono text-4xl text-black tracking-tight md:text-6xl dark:text-white",
        className
      )}
    >
      <style href="kokonutui-type-writer" precedence="default">
        {CARET_KEYFRAMES}
      </style>
      {/* Screen readers get every phrase once instead of whatever partial
          string is on screen. */}
      <span className="sr-only">
        {sequences.map((sequence) => sequence.text).join(", ")}
      </span>
      <motion.span
        animate={{ opacity: 1 }}
        aria-hidden="true"
        className="inline-grid"
        initial={{ opacity: 0 }}
        ref={ref}
        transition={{ duration: 0.5 }}
      >
        <span className="invisible col-start-1 row-start-1 flex items-center gap-1">
          <span>{longestText}</span>
          <span className="w-[3px]" />
        </span>
        <span className="col-start-1 row-start-1 flex items-center gap-1">
          <span className="min-h-[1.2em]">{displayText}</span>
          <span className="inline-block h-[1em] w-[3px] bg-current motion-safe:animate-[kokonutui-typewriter-caret_1s_linear_infinite]" />
        </span>
      </motion.span>
    </Component>
  );
}
