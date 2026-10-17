"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MONO } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const VISIBLE_MS = 2000;
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

/**
 * Holds the latest copy for a moment; a new copy restarts the clock. The
 * clock stops while the tab is hidden, so the toast is still there when you
 * come back to it.
 */
function useLatestCopy() {
  const [copied, setCopied] = useState<Copied | null>(null);
  const timer = useRef<number | null>(null);
  const showing = useRef(false);

  useEffect(() => {
    const stop = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const start = () => {
      stop();
      if (document.hidden) {
        return;
      }
      timer.current = window.setTimeout(() => {
        showing.current = false;
        setCopied(null);
      }, VISIBLE_MS);
    };
    const show = (next: Copied) => {
      showing.current = true;
      setCopied(next);
      start();
    };
    const onVisibility = () => {
      if (!showing.current) {
        return;
      }
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };
    listeners.add(show);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      listeners.delete(show);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return copied;
}

/**
 * One toast for the whole site, mounted in the root layout. It shows up
 * readable on the frame after the click, and a copy made while it is up
 * swaps the line in place instead of stacking a second one. It never takes
 * the pointer, so nothing under it is blocked.
 */
export function CopyToast() {
  const copied = useLatestCopy();

  return (
    // Reduced motion keeps the fades and drops the movement.
    <MotionConfig reducedMotion="user">
      <output
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <AnimatePresence>
          {copied ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex h-11 min-w-0 max-w-full items-center gap-2.5 rounded-full bg-[#0A0A0A] pr-5 pl-2 text-white dark:bg-white dark:text-black"
              exit={{ opacity: 0, y: 4, transition: { duration: 0.14 } }}
              initial={{ opacity: 0, y: 8 }}
              key="pill"
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2CD242] text-white dark:bg-[#1FA834]">
                <Check id={copied.id} />
              </span>
              <span className="font-medium text-[13px]">Copied</span>
              {copied.detail ? (
                <Detail
                  className="text-white/55 dark:text-black/50"
                  copied={copied}
                />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </output>
    </MotionConfig>
  );
}

/** The copied line, cross-faded when a new copy comes in. */
function Detail({ copied, className }: { copied: Copied; className: string }) {
  return (
    <span className="grid min-w-0 max-w-[230px]">
      <AnimatePresence initial={false}>
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            MONO,
            "col-start-1 row-start-1 truncate text-[11.5px] leading-4",
            className
          )}
          exit={{ opacity: 0, y: -3 }}
          initial={{ opacity: 0, y: 3 }}
          key={copied.id}
          transition={{ duration: 0.14, ease: EASE_OUT }}
        >
          {copied.detail}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The check, drawn on every copy. */
function Check({ id }: { id: number }) {
  const reduce = useReducedMotion();

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
        transition={{ duration: 0.22, ease: EASE_OUT }}
      />
    </svg>
  );
}
