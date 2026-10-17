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
const SPRING = { type: "spring", bounce: 0.18, duration: 0.45 } as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/**
 * The pill is laid out at its widest and clipped down to the width it shows,
 * so the morph runs on clip-path and transform alone: no layout per frame.
 * The visible part is kept centered by sliding the pill half the clipped
 * amount.
 */
function clipTo(shell: number, visible: number) {
  const hidden = Math.max(shell - visible, 0);
  return {
    clipPath: `inset(0px ${hidden}px 0px 0px round 22px)`,
    transform: `translateX(${hidden / 2}px)`,
  };
}

/**
 * An ink pill that arrives as a dot and opens out to fit its words, then
 * folds back into the dot before it leaves. A new copy re-fits the width.
 */
function Pill({ copied }: { copied: Copied }) {
  const reduce = useReducedMotion();
  const row = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate();
  const [isPresent, safeToRemove] = usePresence();

  // Start as a dot at the pill's real width (narrower on phones).
  useLayoutEffect(() => {
    if (pill.current) {
      Object.assign(pill.current.style, clipTo(pill.current.offsetWidth, DOT));
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fit when the line changes
  useLayoutEffect(() => {
    const shell = pill.current;
    if (!shell) {
      return;
    }
    const open = clipTo(shell.offsetWidth, row.current?.offsetWidth ?? DOT);
    if (reduce) {
      animate(shell, open, { duration: 0 });
      animate("[data-words]", { opacity: 1 }, { duration: 0 });
      animate(scope.current, { opacity: 1 }, { duration: 0.15 });
      return;
    }
    // On a repeat copy the pill is already up, so only the fit moves.
    animate(
      scope.current,
      { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
      { duration: 0.24, ease: EASE_OUT }
    );
    animate(shell, open, { ...SPRING, delay: 0.05 });
    animate(
      "[data-words]",
      { opacity: 1, filter: "blur(0px)" },
      { delay: 0.14, duration: 0.2, ease: EASE_OUT }
    );
  }, [copied.id]);

  useEffect(() => {
    if (isPresent) {
      return;
    }
    // A copy made while it leaves brings it back: stop folding and let the
    // entrance above take over from wherever it got to.
    let cancelled = false;
    const leave = async () => {
      if (reduce) {
        await animate(scope.current, { opacity: 0 }, { duration: 0.15 });
      } else {
        const shell = pill.current;
        await Promise.all([
          animate(
            "[data-words]",
            { opacity: 0, filter: "blur(4px)" },
            { duration: 0.1, ease: EASE_OUT }
          ),
          shell &&
            animate(shell, clipTo(shell.offsetWidth, DOT), {
              delay: 0.04,
              duration: 0.2,
              ease: EASE_IN_OUT,
            }),
          animate(
            scope.current,
            { opacity: 0, transform: "translateY(4px)" },
            { delay: 0.16, duration: 0.12, ease: EASE_OUT }
          ),
        ]);
      }
      if (!cancelled) {
        safeToRemove();
      }
    };
    leave();
    return () => {
      cancelled = true;
    };
  }, [isPresent, animate, scope, reduce, safeToRemove]);

  return (
    <div
      className="max-w-full"
      ref={scope}
      style={{
        opacity: 0,
        transform: reduce ? undefined : "translateY(14px)",
        filter: reduce ? undefined : "blur(4px)",
      }}
    >
      <div
        className="relative h-11 w-[380px] max-w-full overflow-hidden rounded-full bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
        ref={pill}
      >
        <div
          className="absolute inset-y-0 left-0 flex w-max max-w-full items-center gap-2.5 pr-5 pl-2"
          ref={row}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2CD242] text-white dark:bg-[#1FA834]">
            <Check id={copied.id} reduce={reduce} />
          </span>
          <span
            className="flex min-w-0 items-baseline gap-2 whitespace-nowrap"
            data-words
            style={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
          >
            <span className="font-medium text-[13px]">Copied</span>
            {copied.detail ? (
              <Detail
                className="inline-block min-w-0 max-w-[230px] text-white/55 dark:text-black/50"
                copied={copied}
                reduce={reduce}
              />
            ) : null}
          </span>
        </div>
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
        animate={{
          opacity: 1,
          transform: "translateY(0px)",
          filter: "blur(0px)",
        }}
        className={cn(MONO, "truncate text-[11.5px] leading-4", className)}
        exit={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, transform: "translateY(-4px)", filter: "blur(2px)" }
        }
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" }
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
