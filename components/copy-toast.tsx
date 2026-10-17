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
// A copy that takes longer than this shows Copying first, so the click is
// answered while it waits.
const PENDING_AFTER_MS = 100;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface Copied {
  id: number;
  detail?: string;
  /** Still waiting on the clipboard write. */
  pending?: boolean;
  /** The write failed; the toast steps aside and the button says so. */
  failed?: boolean;
}

const WORDY = /[\p{L}\p{N}]/u;

const listeners = new Set<(copied: Copied) => void>();
let lastId = 0;

function emit(copied: Copied) {
  for (const listener of listeners) {
    listener(copied);
  }
}

/**
 * Confirm a copy with the toast at the foot of the page. `detail` names what
 * was copied (a command, a file); only its first line is shown. Pass the
 * write as `pending` when it has to wait on the network: a quick one goes
 * straight to Copied, a slow one shows Copying with a spinner until it lands.
 */
export function announceCopy(detail?: string, pending?: Promise<unknown>) {
  lastId += 1;
  const copied = { id: lastId, detail: firstLine(detail) };
  if (!pending) {
    emit(copied);
    return;
  }
  const slow = window.setTimeout(
    () => emit({ ...copied, pending: true }),
    PENDING_AFTER_MS
  );
  pending.then(
    () => {
      window.clearTimeout(slow);
      emit(copied);
    },
    () => {
      window.clearTimeout(slow);
      emit({ ...copied, failed: true });
    }
  );
}

/** The first line that says something, skipping lone braces and brackets. */
function firstLine(text?: string) {
  const lines = text?.split("\n").map((line) => line.trim()) ?? [];
  return lines.find((line) => WORDY.test(line)) ?? lines.find(Boolean);
}

/**
 * Holds the latest copy for a moment; a new copy restarts the clock. The
 * clock waits while a copy is pending and stops while the tab is hidden, so
 * the toast is still there when you come back to it.
 */
function useLatestCopy() {
  const [copied, setCopied] = useState<Copied | null>(null);
  const timer = useRef<number | null>(null);
  const shown = useRef<Copied | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const hide = () => {
      stop();
      shown.current = null;
      setCopied(null);
    };
    const start = () => {
      stop();
      if (document.hidden || shown.current?.pending) {
        return;
      }
      timer.current = window.setTimeout(hide, VISIBLE_MS);
    };
    const show = (next: Copied) => {
      const current = shown.current;
      if (next.failed) {
        if (current?.id === next.id) {
          hide();
        }
        return;
      }
      // A slow copy that lands after a newer one leaves the newer one up.
      if (current && next.id < current.id) {
        return;
      }
      shown.current = next;
      setCopied(next);
      start();
    };
    const onVisibility = () => {
      if (!shown.current) {
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
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                  copied.pending
                    ? "bg-white/15 text-white dark:bg-black/10 dark:text-black"
                    : "bg-[#2CD242] text-white dark:bg-[#1FA834]"
                )}
              >
                {copied.pending ? <Spinner /> : <Check id={copied.id} />}
              </span>
              <span className="font-medium text-[13px]">
                {copied.pending ? "Copying" : "Copied"}
              </span>
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

/** Turns while a slow copy is on its way; holds still for reduced motion. */
function Spinner() {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      fill="none"
      viewBox="0 0 16 16"
    >
      <title>Copying</title>
      <circle
        cx="8"
        cy="8"
        r="5.5"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M13.5 8A5.5 5.5 0 0 0 8 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
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
