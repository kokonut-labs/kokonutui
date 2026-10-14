"use client";

/**
 * @author: @dorianbaffier
 * @description: Typewriter
 * @version: 1.1.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion, useInView, useReducedMotion } from "motion/react";
import { type Ref, useEffect, useRef, useState } from "react";
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
   * How a phrase is erased. `"backspace"` removes it one character at a
   * time; `"select"` highlights it right to left, as with Shift+Home, then
   * cuts it in one go.
   */
  deleteMode?: "backspace" | "select";
  /**
   * Hit a neighbouring key now and then, pause, backspace and correct it.
   * `true` is about a 4% chance per letter; a number sets the chance.
   */
  typos?: boolean | number;
  /** Seed for the variance and typos, so every visit types the same way. */
  seed?: number;
  /**
   * Stops the typing where it is. Wire it to a pause control to let users
   * stop the endless loop (WCAG 2.2.2). It also pauses while off screen.
   */
  paused?: boolean;
  /** Element to render, e.g. `h1` when it is the page title. */
  as?: TypewriterElement;
  /** Classes for the wrapper. Its width sets the font size. */
  className?: string;
  /** Classes for the text itself, e.g. to fix the font size. */
  textClassName?: string;
}

const DEFAULT_SEQUENCES: TypewriterSequence[] = [
  { text: "Typewriter", deleteAfter: true },
  { text: "Multiple Words", deleteAfter: true },
  { text: "Auto Loop", deleteAfter: false },
];

const NEXT_SEQUENCE_DELAY = 100;
// The caret stays solid while keys are being hit and only starts blinking
// once typing has stopped for this long, as in a text editor.
const CARET_IDLE_MS = 500;
// A wrong key: noticed after this pause, then backspaced and retyped.
const TYPO_NOTICE_MS = 250;
const DEFAULT_TYPO_RATE = 0.04;
// Select-to-delete: the highlight sweeps the phrase in this long, holds
// for a moment, then the text is cut.
const SELECT_SWEEP_MS = 120;
const SELECT_HOLD_MS = 220;

// The blink is a CSS animation so it runs off the main thread: solid for
// the first third of the cycle, fades out, then stays hidden.
const CARET_KEYFRAMES =
  "@keyframes kokonutui-typewriter-caret { 0%, 33.333% { opacity: 1; } 66.667%, 100% { opacity: 0; } }";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** The keys around a letter on a QWERTY keyboard, in the same case. */
function neighbours(char: string) {
  const lower = char.toLowerCase();
  const row = KEY_ROWS.findIndex((keys) => keys.includes(lower));
  if (row === -1) {
    return "";
  }
  const col = KEY_ROWS[row].indexOf(lower);
  const around = [
    KEY_ROWS[row][col - 1],
    KEY_ROWS[row][col + 1],
    KEY_ROWS[row - 1]?.[col],
    KEY_ROWS[row + 1]?.[col],
  ]
    .filter(Boolean)
    .join("");
  return char === lower ? around : around.toUpperCase();
}

/** Small seeded generator (Park-Miller), 0 to 1. */
function createRandom(seed: number) {
  let state = (Math.abs(Math.floor(seed)) % 2_147_483_646) + 1;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

function getTypingDelay(
  typingSpeed: number,
  naturalVariance: boolean,
  random: () => number
) {
  if (!naturalVariance) {
    return typingSpeed;
  }
  const roll = random();
  // 10% chance of a hesitation, 10% chance of a burst.
  if (roll < 0.1) {
    return typingSpeed * 2;
  }
  if (roll > 0.9) {
    return typingSpeed * 0.5;
  }
  // Otherwise +/- 40%.
  return typingSpeed * (0.6 + random() * 0.8);
}

class Stopped extends Error {}

interface Position {
  sequence: number;
  char: number;
  deleting: boolean;
}

interface Screen {
  text: string;
  /** Characters at the end of `text` shown as selected. */
  selected: number;
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
  deleteMode = "backspace",
  typos = false,
  seed = 7,
  paused = false,
  as: Component = "div",
  className,
  textClassName,
}: TypewriterTitleProps) {
  const [screen, setScreen] = useState<Screen>({ text: "", selected: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref);
  const isRunning = !paused && isInView;
  const shouldReduceMotion = useReducedMotion();
  const position = useRef<Position>({ sequence: 0, char: 0, deleting: false });
  const random = useRef<() => number>(createRandom(seed));

  const sequencesRef = useRef(sequences);
  useEffect(() => {
    sequencesRef.current = sequences;
  }, [sequences]);

  useEffect(() => {
    random.current = createRandom(seed);
  }, [seed]);

  // Reduced motion: show the final phrase, no typing loop. Keyed on the
  // phrase itself so new `sequences` still update the text.
  const finalText = sequences.at(-1)?.text ?? "";
  useEffect(() => {
    if (shouldReduceMotion) {
      setScreen({ text: finalText, selected: 0 });
    }
  }, [shouldReduceMotion, finalText]);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }
    // Paused or off screen: keep the current text. `position` remembers
    // where it was, so typing resumes there.
    if (!isRunning) {
      return;
    }

    let typoRate = 0;
    if (typeof typos === "number") {
      typoRate = typos;
    } else if (typos) {
      typoRate = DEFAULT_TYPO_RATE;
    }
    const pos = position.current;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (stopped) {
          reject(new Stopped());
          return;
        }
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (stopped) {
            reject(new Stopped());
          } else {
            resolve();
          }
        }, ms);
        timers.add(timer);
      });

    // Every keystroke holds the caret solid; it blinks again once idle.
    const keystroke = () => {
      const caret = caretRef.current;
      if (!caret) {
        return;
      }
      caret.dataset.idle = "false";
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        caret.dataset.idle = "true";
      }, CARET_IDLE_MS);
    };
    const show = (text: string, selected = 0) => {
      setScreen({ text, selected });
    };

    const typeChar = async (text: string) => {
      const wrongKeys = neighbours(text[pos.char]);
      if (wrongKeys && random.current() < typoRate) {
        const wrong =
          wrongKeys[Math.floor(random.current() * wrongKeys.length)];
        show(text.slice(0, pos.char) + wrong);
        keystroke();
        await wait(TYPO_NOTICE_MS + typingSpeed);
        show(text.slice(0, pos.char));
        keystroke();
        await wait(typingSpeed * 1.5);
      }
      pos.char += 1;
      show(text.slice(0, pos.char));
      keystroke();
      await wait(getTypingDelay(typingSpeed, naturalVariance, random.current));
    };

    const erase = async (text: string) => {
      if (deleteMode === "select") {
        const length = pos.char;
        const step = SELECT_SWEEP_MS / Math.max(length, 1);
        for (let selected = 1; selected <= length; selected++) {
          show(text.slice(0, length), selected);
          keystroke();
          await wait(step);
        }
        await wait(SELECT_HOLD_MS);
        pos.char = 0;
        show("");
        keystroke();
        return;
      }
      while (pos.char > 0) {
        pos.char -= 1;
        show(text.slice(0, pos.char));
        keystroke();
        await wait(deleteSpeed);
      }
    };

    /** Move on to the next phrase. False when the run is over. */
    const advance = async (delay: number) => {
      const isLast = pos.sequence >= sequencesRef.current.length - 1;
      if (isLast && !autoLoop) {
        return false;
      }
      // Advance first, so pausing during the wait can't retype this one.
      pos.sequence = isLast ? 0 : pos.sequence + 1;
      pos.char = 0;
      pos.deleting = false;
      await wait(isLast ? loopDelay : delay);
      show("");
      return true;
    };

    const phrase = async () => {
      const list = sequencesRef.current;
      // `sequences` may have shrunk past the current phrase: start over.
      if (pos.sequence >= list.length) {
        pos.sequence = 0;
        pos.char = 0;
        pos.deleting = false;
      }
      const sequence = list[pos.sequence];
      if (!sequence) {
        return false;
      }
      const { text } = sequence;
      pos.char = Math.min(pos.char, text.length);
      // Resuming after a pause: put the screen back in step.
      show(text.slice(0, pos.char));

      if (!pos.deleting) {
        while (pos.char < text.length) {
          await typeChar(text);
        }
        const pause = sequence.pauseAfter ?? pauseBeforeDelete;
        const isLast = pos.sequence === list.length - 1;
        // Looping deletes the last phrase too, instead of it vanishing.
        if (!(sequence.deleteAfter || (isLast && autoLoop))) {
          return advance(pause);
        }
        await wait(pause);
        pos.deleting = true;
      }
      await erase(text);
      return advance(NEXT_SEQUENCE_DELAY);
    };

    const run = async () => {
      try {
        await wait(startDelay);
        while (await phrase()) {
          // On to the next phrase.
        }
      } catch (error) {
        if (!(error instanceof Stopped)) {
          throw error;
        }
      }
    };
    run();

    const caret = caretRef.current;
    return () => {
      stopped = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      clearTimeout(idleTimer);
      if (caret) {
        caret.dataset.idle = "true";
      }
    };
  }, [
    // Content comes through sequencesRef, so a new array with the same
    // phrases doesn't restart the effect.
    typingSpeed,
    deleteSpeed,
    pauseBeforeDelete,
    autoLoop,
    loopDelay,
    startDelay,
    naturalVariance,
    deleteMode,
    typos,
    shouldReduceMotion,
    isRunning,
  ]);

  const kept = screen.text.slice(0, screen.text.length - screen.selected);
  const selected = screen.text.slice(kept.length);

  return (
    <Component
      className={cn(
        "@container flex w-full items-center justify-center font-mono text-black tracking-tight dark:text-white",
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
        className={cn(
          // Every phrase sits invisibly in the same grid cell, so the box is
          // as wide as the widest one as rendered (proportional fonts, CJK)
          // and the text grows from a fixed left edge.
          "inline-grid justify-items-start whitespace-pre pr-[0.25em] @2xl:text-6xl @lg:text-5xl text-4xl leading-[1.2]",
          textClassName
        )}
        initial={{ opacity: 0 }}
        ref={ref}
        transition={{ duration: 0.5 }}
      >
        {sequences.map((sequence, index) => (
          <span
            className="invisible col-start-1 row-start-1"
            // biome-ignore lint/suspicious/noArrayIndexKey: phrases can repeat; the list is static.
            key={index}
          >
            {sequence.text}
          </span>
        ))}
        <span className="col-start-1 row-start-1 min-h-[1.2em]">
          {kept}
          <Caret caretRef={caretRef} />
          {selected && (
            <span className="rounded-[0.08em] bg-sky-500/25 dark:bg-sky-400/30">
              {selected}
            </span>
          )}
        </span>
      </motion.span>
    </Component>
  );
}

/**
 * Takes no room, so the text never shifts when the caret moves to the start
 * of a selection. Solid while typing; blinks once idle.
 */
function Caret({ caretRef }: { caretRef: Ref<HTMLSpanElement> }) {
  return (
    <span className="relative inline-block w-0">
      <span
        className="absolute bottom-[-0.1em] left-[0.04em] h-[1.05em] w-[0.08em] min-w-[2px] bg-current motion-safe:data-[idle=true]:animate-[kokonutui-typewriter-caret_1s_linear_infinite]"
        data-idle="true"
        ref={caretRef}
      />
    </span>
  );
}
