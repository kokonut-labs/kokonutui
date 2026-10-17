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
const MAC = /Mac|iPhone|iPad/;

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

type Variant = "pill" | "card";

/**
 * One toast for the whole site, mounted in the root layout. A copy made while
 * it is up updates it in place instead of stacking a second one. It never
 * takes the pointer, so nothing under it is blocked.
 *
 * Prototype: `?toast=card` shows the card direction, the default is the pill.
 */
export function CopyToast() {
  const copied = useLatestCopy();
  const [variant, setVariant] = useState<Variant>("pill");

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("toast");
    if (asked === "card") {
      setVariant("card");
    }
  }, []);

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {copied && variant === "pill" ? (
          <Pill copied={copied} key="pill" />
        ) : null}
        {copied && variant === "card" ? (
          <Card copied={copied} key="card" />
        ) : null}
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

/**
 * A rounded card with the check on a tinted tile, the copied line under the
 * title, and the paste shortcut for this platform on the right.
 */
function Card({ copied }: { copied: Copied }) {
  const reduce = useReducedMotion();
  const [paste, setPaste] = useState("Ctrl V");

  useEffect(() => {
    if (MAC.test(navigator.userAgent)) {
      setPaste("⌘V");
    }
  }, []);

  return (
    <motion.div
      animate={
        reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      className="flex w-[360px] max-w-full items-center gap-3 rounded-[18px] bg-white p-2 pr-3 text-black shadow-[0_16px_40px_-18px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.07] dark:bg-[#161616] dark:text-white dark:shadow-[0_16px_40px_-18px_rgba(0,0,0,0.9)] dark:ring-white/[0.09]"
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : {
              opacity: 0,
              y: 8,
              filter: "blur(3px)",
              transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
            }
      }
      initial={
        reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(6px)" }
      }
      transition={
        reduce
          ? { duration: 0.15 }
          : {
              default: { duration: 0.24, ease: EASE_OUT },
              y: { type: "spring", bounce: 0.25, duration: 0.5 },
            }
      }
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#2CD242]/[0.14] text-[#1FA834] dark:bg-[#3BB44B]/[0.16] dark:text-[#3BB44B]">
        <Check id={copied.id} reduce={reduce} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[13.5px] leading-5">
          Copied to clipboard
        </p>
        {copied.detail ? (
          <Detail
            className="block text-black/50 dark:text-white/50"
            copied={copied}
            reduce={reduce}
          />
        ) : null}
      </div>
      <kbd
        className={cn(
          MONO,
          "shrink-0 rounded-[7px] bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-black/45 ring-1 ring-black/[0.07] dark:bg-white/[0.06] dark:text-white/50 dark:ring-white/[0.08]"
        )}
      >
        {paste}
      </kbd>
    </motion.div>
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
