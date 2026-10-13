"use client";

/**
 * @author: @dorianbaffier
 * @description: Split Flap
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.";
const DEFAULT_WORDS = ["KOKONUT UI", "DEPARTURES", "GATE 26", "ON TIME"];

// One flip, in ms, when a cell has only a few characters to go.
const STEP_MS = 70;
// The fastest a cell may flip when it has a long way to travel, and the
// longest any cell may take in total. Real boards are slow; this keeps
// the drama without making people wait.
const MIN_STEP_MS = 32;
const MAX_RUN_MS = 1600;
// Cells start one after another, left to right.
const CELL_STAGGER_MS = 28;
// Share of a flip spent on the top half falling; the rest is the bottom
// half landing.
const FALL_SHARE = 0.55;

export interface SplitFlapProps {
  /** Words to cycle through. Ignored when `value` is set. */
  words?: string[];
  /** Show this text instead of cycling. */
  value?: string;
  /** Time (ms) each word stays up when cycling. */
  interval?: number;
  /** Number of cells. Defaults to the longest word. */
  length?: number;
  /** Characters on each flap reel, in order. Must include a space. */
  charset?: string;
  className?: string;
}

export default function SplitFlap({
  words = DEFAULT_WORDS,
  value,
  interval = 3200,
  length,
  charset = DEFAULT_CHARSET,
  className,
}: SplitFlapProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const cells =
    length ?? Math.max(value?.length ?? 0, ...words.map((w) => w.length));

  useEffect(() => {
    if (value !== undefined || words.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      // A hidden tab shouldn't run the board through words nobody sees.
      if (document.visibilityState === "visible") {
        setWordIndex((i) => (i + 1) % words.length);
      }
    }, interval);
    return () => window.clearInterval(timer);
  }, [value, words.length, interval]);

  const text = (value ?? words[wordIndex] ?? "")
    .toUpperCase()
    .padEnd(cells, " ")
    .slice(0, cells);

  return (
    <div
      aria-label={text.trim()}
      aria-live="polite"
      className={cn(
        "inline-flex gap-[0.08em] rounded-[0.2em] bg-zinc-950 p-[0.14em] font-medium font-mono text-4xl text-zinc-50 dark:bg-black dark:ring-1 dark:ring-zinc-800",
        className
      )}
      role="img"
    >
      {Array.from(text).map((char, i) => (
        <FlapCell
          charset={charset}
          delay={i * CELL_STAGGER_MS}
          // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional.
          key={i}
          target={charset.includes(char) ? char : " "}
        />
      ))}
    </div>
  );
}

interface Flip {
  from: string;
  to: string;
  id: number;
  duration: number;
  last: boolean;
}

function FlapCell({
  target,
  charset,
  delay,
}: {
  target: string;
  charset: string;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  // Every cell starts blank, on the server too, then flips to its letter
  // after mount, so the board introduces itself.
  const [current, setCurrent] = useState(" ");
  const [flip, setFlip] = useState<Flip | null>(null);
  // Where the reel physically is, which can be ahead of `current` mid-run.
  // A new target always starts from here.
  const reel = useRef(" ");

  useEffect(() => {
    if (reel.current === target) {
      return;
    }
    if (reduceMotion) {
      reel.current = target;
      setCurrent(target);
      setFlip(null);
      return;
    }
    // A reel only turns one way, so the distance wraps round the charset.
    const from = Math.max(charset.indexOf(reel.current), 0);
    const to = charset.indexOf(target);
    const steps = (to - from + charset.length) % charset.length;
    const stepMs = Math.max(MIN_STEP_MS, Math.min(STEP_MS, MAX_RUN_MS / steps));

    let index = from;
    let remaining = steps;
    let id = 0;
    let timer = window.setTimeout(function tick() {
      const next = charset[(index + 1) % charset.length];
      remaining -= 1;
      id += 1;
      // The final flip is slower and lands with a small bounce.
      const last = remaining === 0;
      const duration = last ? stepMs * 2.4 : stepMs;
      setFlip({ from: charset[index], to: next, id, duration, last });
      index = (index + 1) % charset.length;
      reel.current = next;
      if (last) {
        timer = window.setTimeout(() => {
          setCurrent(next);
          setFlip(null);
        }, duration);
      } else {
        timer = window.setTimeout(tick, stepMs);
      }
    }, delay);
    return () => {
      window.clearTimeout(timer);
      // Stop on whatever letter the reel had reached.
      setCurrent(reel.current);
      setFlip(null);
    };
  }, [target, charset, delay, reduceMotion]);

  const top = flip ? flip.to : current;
  const bottom = flip ? flip.from : current;

  return (
    <span
      aria-hidden="true"
      className="relative block h-[1.45em] w-[1.04em] [perspective:6em]"
    >
      <Half char={top} part="top" />
      <Half char={bottom} part="bottom" />

      {flip && <FlipLeaves flip={flip} key={flip.id} />}

      {/* The hinge gap between the two halves. */}
      <span className="absolute inset-x-0 top-1/2 h-[0.04em] -translate-y-1/2 bg-black" />
      <span className="absolute top-1/2 -left-[0.04em] h-[0.18em] w-[0.08em] -translate-y-1/2 rounded-full bg-zinc-700" />
      <span className="absolute top-1/2 -right-[0.04em] h-[0.18em] w-[0.08em] -translate-y-1/2 rounded-full bg-zinc-700" />
    </span>
  );
}

/**
 * One flip: the top half of the old letter falls away and the bottom half
 * of the new one swings down onto the stop. Every flip is a fixed,
 * fire-and-forget animation, so it runs on the Web Animations API, which
 * keeps it on the compositor instead of the main thread, and a board of
 * busy cells doesn't mount a stack of animated components per step.
 */
function FlipLeaves({ flip }: { flip: Flip }) {
  const top = useRef<HTMLSpanElement>(null);
  const topShade = useRef<HTMLSpanElement>(null);
  const bottom = useRef<HTMLSpanElement>(null);
  const bottomShade = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const fall = flip.duration * FALL_SHARE;
    const land = flip.duration - fall;
    // The top accelerates like a real flap dropping, then hands over at
    // the hinge, darkening as it turns away from the light.
    top.current?.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }],
      {
        duration: fall,
        easing: "cubic-bezier(0.55, 0, 1, 0.45)",
        fill: "forwards",
      }
    );
    topShade.current?.animate([{ opacity: 0 }, { opacity: 0.45 }], {
      duration: fall,
      fill: "forwards",
    });
    // The last flip lands slower and bounces once off the stop.
    bottom.current?.animate(
      flip.last
        ? [
            { transform: "rotateX(90deg)", easing: "ease-out" },
            { transform: "rotateX(0deg)", offset: 0.55, easing: "ease-out" },
            { transform: "rotateX(14deg)", offset: 0.78, easing: "ease-in" },
            { transform: "rotateX(0deg)" },
          ]
        : [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }],
      {
        delay: fall,
        duration: land,
        easing: flip.last ? "linear" : "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "both",
      }
    );
    bottomShade.current?.animate([{ opacity: 0.45 }, { opacity: 0 }], {
      delay: fall,
      duration: land,
      fill: "both",
    });
  }, [flip]);

  return (
    <>
      <span
        className="absolute inset-x-0 top-0 h-1/2 origin-bottom [backface-visibility:hidden]"
        ref={top}
      >
        <HalfFace char={flip.from} part="top" />
        <span
          className="absolute inset-0 rounded-t-[0.12em] bg-black opacity-0"
          ref={topShade}
        />
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-1/2 origin-top [backface-visibility:hidden] [transform:rotateX(90deg)]"
        ref={bottom}
      >
        <HalfFace char={flip.to} part="bottom" />
        <span
          className="absolute inset-0 rounded-b-[0.12em] bg-black opacity-45"
          ref={bottomShade}
        />
      </span>
    </>
  );
}

function Half({ char, part }: { char: string; part: "top" | "bottom" }) {
  return (
    <span
      className={cn(
        "absolute inset-x-0 h-1/2",
        part === "top" ? "top-0" : "bottom-0"
      )}
    >
      <HalfFace char={char} part={part} />
    </span>
  );
}

/** One half of a flap: the full glyph, cropped to the top or bottom. */
function HalfFace({ char, part }: { char: string; part: "top" | "bottom" }) {
  return (
    <span
      className={cn(
        "absolute inset-0 overflow-hidden bg-zinc-800",
        part === "top" ? "rounded-t-[0.12em]" : "rounded-b-[0.12em]"
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 flex h-[200%] items-center justify-center leading-none",
          part === "top" ? "top-0" : "bottom-0"
        )}
      >
        {char}
      </span>
    </span>
  );
}
