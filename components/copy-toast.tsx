"use client";

import {
  AnimatePresence,
  motion,
  useAnimate,
  usePresence,
  useReducedMotion,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MONO } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const VISIBLE_MS = 2200;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface Copied {
  id: number;
  detail?: string;
}

const WORDY = /[\p{L}\p{N}]/u;

const listeners = new Set<(copied: Copied) => void>();
let lastId = 0;

/**
 * Confirm a copy with the toast at the foot of the page. `detail` names what
 * was copied (a command, a file); only its first line is shown.
 */
export function announceCopy(detail?: string) {
  lastId += 1;
  const copied = { id: lastId, detail: firstLine(detail) };
  for (const listener of listeners) {
    listener(copied);
  }
}

/** The first line that says something, skipping lone braces and brackets. */
function firstLine(text?: string) {
  const lines = text?.split("\n").map((line) => line.trim()) ?? [];
  return lines.find((line) => WORDY.test(line)) ?? lines.find(Boolean);
}

/** Holds the latest copy for a moment; a new copy restarts the clock. */
function useLatestCopy() {
  const [copied, setCopied] = useState<Copied | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const show = (next: Copied) => {
      setCopied(next);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => setCopied(null), VISIBLE_MS);
    };
    listeners.add(show);
    return () => {
      listeners.delete(show);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  return copied;
}

/**
 * One toast for the whole site, mounted in the root layout. A copy made while
 * it is up updates it in place instead of stacking a second one. It never
 * takes the pointer, so nothing under it is blocked.
 */
export function CopyToast() {
  const copied = useLatestCopy();

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {copied ? <Pill copied={copied} key="pill" /> : null}
      </AnimatePresence>
    </output>
  );
}

const DOT = 44;
const SPRING = { type: "spring", bounce: 0.18, duration: 0.5 } as const;

/**
 * An ink pill that arrives as a dot and opens out to fit its words, then
 * folds back into the dot before it leaves. A new copy re-fits the width.
 */
function Pill({ copied }: { copied: Copied }) {
  const reduce = useReducedMotion();
  const row = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate();
  const [isPresent, safeToRemove] = usePresence();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fit when the line changes
  useLayoutEffect(() => {
    const width = row.current?.offsetWidth ?? DOT;
    if (reduce) {
      animate(scope.current, { width, opacity: 1 }, { duration: 0.15 });
      animate("[data-words]", { opacity: 1 }, { duration: 0 });
      return;
    }
    // On a repeat copy the pill is already up, so only the width moves.
    animate(
      scope.current,
      { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
      { duration: 0.26, ease: EASE_OUT }
    );
    animate(scope.current, { width }, { ...SPRING, delay: 0.06 });
    animate(
      "[data-words]",
      { opacity: 1, filter: "blur(0px)" },
      { delay: 0.16, duration: 0.2, ease: EASE_OUT }
    );
  }, [copied.id]);

  useEffect(() => {
    if (isPresent) {
      return;
    }
    const leave = async () => {
      if (!reduce) {
        await animate(
          "[data-words]",
          { opacity: 0, filter: "blur(4px)" },
          { duration: 0.1 }
        );
        await animate(
          scope.current,
          { width: DOT },
          { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
        );
      }
      await animate(
        scope.current,
        reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" },
        { duration: 0.14 }
      );
      safeToRemove();
    };
    leave();
  }, [isPresent, animate, scope, reduce, safeToRemove]);

  return (
    <div
      className="relative h-11 max-w-full overflow-hidden rounded-full bg-[#0A0A0A] text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] dark:bg-white dark:text-black dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)]"
      ref={scope}
      style={{
        width: DOT,
        opacity: 0,
        transform: reduce ? undefined : "translateY(14px)",
        filter: reduce ? undefined : "blur(4px)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 flex w-max items-center gap-2.5 pr-5 pl-2"
        ref={row}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2CD242] text-white dark:bg-[#1FA834]">
          <Check id={copied.id} reduce={reduce} />
        </span>
        <span
          className="flex items-baseline gap-2 whitespace-nowrap"
          data-words
          style={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
        >
          <span className="font-medium text-[13px]">Copied</span>
          {copied.detail ? (
            <Detail
              className="inline-block max-w-[230px] text-white/55 dark:text-black/50"
              copied={copied}
              reduce={reduce}
            />
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** The copied line, swapped with a short blur when a new copy comes in. */
function Detail({
  copied,
  className,
  reduce,
}: {
  copied: Copied;
  className?: string;
  reduce: boolean | null;
}) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        className={cn(MONO, "truncate text-[11.5px] leading-4", className)}
        exit={
          reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }
        }
        initial={
          reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }
        }
        key={copied.id}
        transition={{ duration: 0.18, ease: EASE_OUT }}
      >
        {copied.detail}
      </motion.span>
    </AnimatePresence>
  );
}

/** The check, drawn stroke by stroke on every copy. */
function Check({ id, reduce }: { id: number; reduce: boolean | null }) {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <title>Copied</title>
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5L6.75 11.5L12.5 4.75"
        initial={{ pathLength: reduce ? 1 : 0 }}
        key={id}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ duration: 0.34, delay: 0.1, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}
