"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MONO } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const VISIBLE_MS = 2000;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

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
 * One toast for the whole site, mounted in the root layout. It rises in once,
 * and a copy made while it is up swaps the line and redraws the check instead
 * of stacking a second card. It never takes the pointer, so nothing under it
 * is blocked.
 */
export function CopyToast() {
  const [copied, setCopied] = useState<Copied | null>(null);
  const timer = useRef<number | null>(null);
  const reduce = useReducedMotion();

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

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {copied ? (
          <motion.div
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            className="flex w-[320px] max-w-full items-center gap-3 border border-black/[0.13] bg-white py-2.5 pr-4 pl-3.5 text-black shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)] dark:border-white/[0.14] dark:bg-[#0B0B0B] dark:text-white dark:shadow-none"
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    y: 6,
                    filter: "blur(2px)",
                    transition: { duration: 0.16, ease: EASE_IN },
                  }
            }
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 12, filter: "blur(4px)" }
            }
            key="toast"
            transition={{ duration: reduce ? 0.15 : 0.28, ease: EASE_OUT }}
          >
            <Check id={copied.id} reduce={reduce} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[13px] leading-5">
                Copied to clipboard
              </p>
              {copied.detail ? (
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.p
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className={cn(
                      MONO,
                      "truncate text-[11.5px] text-black/50 leading-4 dark:text-white/50"
                    )}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, y: -4, filter: "blur(2px)" }
                    }
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, y: 4, filter: "blur(2px)" }
                    }
                    key={copied.id}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    {copied.detail}
                  </motion.p>
                </AnimatePresence>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </output>
  );
}

/** The leaf-green check, drawn stroke by stroke on every copy. */
function Check({ id, reduce }: { id: number; reduce: boolean | null }) {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0 text-[#1FA834] dark:text-[#3BB44B]"
      fill="none"
      viewBox="0 0 16 16"
    >
      <title>Copied</title>
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3 8.5L6.5 12L13 4.5"
        initial={{ pathLength: reduce ? 1 : 0 }}
        key={id}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        transition={{ duration: 0.32, delay: 0.06, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}
