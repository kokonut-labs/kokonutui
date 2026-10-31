"use client";

/**
 * @author: @kokonutui
 * @description: AI Context Meter
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ContextSegment {
  id: string;
  label: string;
  tokens: number;
  /** A Tailwind background class for the segment, such as `bg-sky-500`. */
  color?: string;
}

interface AIContextMeterProps {
  /**
   * What fills the context window, in the order to draw it. When omitted, a
   * demo conversation grows on its own.
   */
  segments?: ContextSegment[];
  /** The model's context window, in tokens. */
  limit?: number;
  /** Share of the window at which the conversation compacts, 0 to 1. */
  compactAt?: number;
  /** Shows a Compact button in the panel. The demo compacts by itself. */
  onCompact?: () => void;
  /** Shown beside the meter, like the footer of a prompt box. */
  model?: string;
  defaultOpen?: boolean;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FALLBACK_COLORS = [
  "bg-zinc-300 dark:bg-zinc-600",
  "bg-zinc-400 dark:bg-zinc-500",
  "bg-zinc-600 dark:bg-zinc-400",
  "bg-zinc-900 dark:bg-zinc-100",
];

const DEMO_BASE: ContextSegment[] = [
  { id: "system", label: "System prompt", tokens: 3100 },
  { id: "tools", label: "Tools", tokens: 14_200 },
  { id: "files", label: "Files", tokens: 38_600 },
];
const DEMO_START_MESSAGES = 61_000;
const DEMO_TICK_MS = 1100;
const AUTO_COMPACT_DELAY_MS = 1400;
const SUMMARY_TOKENS = 5800;

/**
 * Grows the demo conversation a turn at a time, pausing offscreen. At the
 * compact threshold it swaps the messages for a short summary, like an agent
 * compacting its context, and carries on.
 */
function useDemoContext(
  enabled: boolean,
  limit: number,
  compactAt: number,
  rootRef: React.RefObject<HTMLElement | null>
) {
  const [messages, setMessages] = useState(DEMO_START_MESSAGES);
  const [summary, setSummary] = useState(0);
  const [visible, setVisible] = useState(true);
  const turnRef = useRef(0);

  useEffect(() => {
    const element = rootRef.current;
    if (!(enabled && element)) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootRef]);

  const base = DEMO_BASE.reduce((sum, segment) => sum + segment.tokens, 0);
  const total = base + summary + messages;
  const full = total >= limit * compactAt;

  useEffect(() => {
    if (!(enabled && visible) || full) {
      return;
    }
    const id = setInterval(() => {
      // Turns alternate between short replies and longer tool results.
      turnRef.current += 1;
      const size =
        turnRef.current % 3 === 0 ? 9400 : 2600 + (turnRef.current % 4) * 900;
      setMessages((value) => value + size);
    }, DEMO_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, visible, full]);

  // Summary is always listed so it grows in from nothing when compacting.
  const segments: ContextSegment[] = [
    ...DEMO_BASE,
    { id: "summary", label: "Summary", tokens: summary },
    { id: "messages", label: "Messages", tokens: messages },
  ];

  const compact = useCallback(() => {
    // The new summary replaces the old one along with the messages.
    setSummary(SUMMARY_TOKENS);
    setMessages(0);
  }, []);

  useEffect(() => {
    if (!(enabled && visible && full)) {
      return;
    }
    const id = setTimeout(compact, AUTO_COMPACT_DELAY_MS);
    return () => clearTimeout(id);
  }, [enabled, visible, full, compact]);

  return { segments, compact };
}

const DEMO_COLORS: Record<string, string> = {
  system: "bg-zinc-300 dark:bg-zinc-600",
  tools: "bg-zinc-400 dark:bg-zinc-500",
  files: "bg-zinc-600 dark:bg-zinc-400",
  summary: "bg-sky-300 dark:bg-sky-700",
  messages: "bg-sky-500 dark:bg-sky-400",
};

/** Eases a number toward its target, so counts roll instead of jumping. */
function useTweened(target: number, duration = 450) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    fromRef.current = valueRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      valueRef.current = fromRef.current + (target - fromRef.current) * eased;
      setValue(valueRef.current);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

const formatTokens = (tokens: number) =>
  tokens >= 1000
    ? `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k`
    : `${Math.round(tokens)}`;

function levelColor(share: number, compactAt: number) {
  // Dark enough to read at 12px on the light bar (amber-500 was 2:1).
  if (share >= compactAt + (1 - compactAt) / 2) {
    return "text-red-600 dark:text-red-400";
  }
  if (share >= compactAt - 0.1) {
    return "text-orange-700 dark:text-orange-400";
  }
  return "text-zinc-900 dark:text-zinc-100";
}

function Ring({ share }: { share: number }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 -rotate-90"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle
        className="stroke-zinc-200 dark:stroke-zinc-700"
        cx="8"
        cy="8"
        r={radius}
        strokeWidth="2"
      />
      <circle
        // No CSS transition: `share` is already tweened, and easing it twice
        // made the ring trail the percentage beside it.
        className="stroke-current"
        cx="8"
        cy="8"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(1, share))}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function Breakdown({
  segments,
  limit,
  compactAt,
  colors,
  onCompact,
}: {
  segments: ContextSegment[];
  limit: number;
  compactAt: number;
  colors: string[];
  onCompact?: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const used = segments.reduce((sum, segment) => sum + segment.tokens, 0);
  const free = Math.max(0, limit - used);
  const shownUsed = useTweened(used);

  return (
    <div className="w-72 p-3">
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Context
        </p>
        <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatTokens(shownUsed)} of {formatTokens(limit)}
        </p>
      </div>

      {/* One bar for the whole window, a segment per source. The tick marks
          where the conversation compacts. */}
      <div className="relative" onPointerLeave={() => setActive(null)}>
        <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
          {segments.map((segment, index) => (
            <span
              className={cn(
                "h-full transition-[width,opacity] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                index > 0 && segment.tokens > 0 && "ml-px",
                colors[index],
                active && active !== segment.id && "opacity-30"
              )}
              key={segment.id}
              onPointerEnter={() => setActive(segment.id)}
              style={{ width: `${(segment.tokens / limit) * 100}%` }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-px bg-zinc-400 dark:bg-zinc-500"
          style={{ left: `${compactAt * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] text-zinc-400 dark:text-zinc-500">
        Compacts at {Math.round(compactAt * 100)}%
      </p>

      <ul className="mt-2 space-y-0.5">
        {segments.map((segment, index) =>
          segment.tokens > 0 ? (
            <li
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors duration-150",
                active === segment.id && "bg-zinc-100 dark:bg-white/5"
              )}
              key={segment.id}
              onPointerEnter={() => setActive(segment.id)}
              onPointerLeave={() => setActive(null)}
            >
              <span className={cn("size-2 rounded-[3px]", colors[index])} />
              <span className="text-zinc-700 dark:text-zinc-300">
                {segment.label}
              </span>
              <span className="ml-auto text-zinc-500 tabular-nums dark:text-zinc-400">
                {formatTokens(segment.tokens)}
              </span>
              <span className="w-9 text-right text-zinc-400 tabular-nums dark:text-zinc-500">
                {((segment.tokens / limit) * 100).toFixed(1)}%
              </span>
            </li>
          ) : null
        )}
        <li className="flex items-center gap-2 px-1.5 py-1 text-xs">
          <span className="size-2 rounded-[3px] ring-1 ring-zinc-300 ring-inset dark:ring-zinc-600" />
          <span className="text-zinc-500 dark:text-zinc-400">Free</span>
          <span className="ml-auto text-zinc-500 tabular-nums dark:text-zinc-400">
            {formatTokens(free)}
          </span>
          <span className="w-9 text-right text-zinc-400 tabular-nums dark:text-zinc-500">
            {((free / limit) * 100).toFixed(1)}%
          </span>
        </li>
      </ul>

      {onCompact && (
        <div className="mt-3 flex items-center justify-between border-zinc-100 border-t pt-3 dark:border-white/10">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Summarize older turns
          </p>
          <button
            className="h-7 rounded-md bg-zinc-900 px-2.5 font-medium text-white text-xs outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/60 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-white dark:text-zinc-900 dark:disabled:bg-white/10 dark:disabled:text-zinc-500 dark:hover:bg-zinc-200"
            disabled={used / limit < 0.4}
            onClick={onCompact}
            type="button"
          >
            Compact now
          </button>
        </div>
      )}
    </div>
  );
}

export default function AIContextMeter({
  segments: segmentsProp,
  limit = 200_000,
  compactAt = 0.8,
  onCompact,
  model = "Claude Opus",
  defaultOpen = false,
  className,
}: AIContextMeterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const demo = useDemoContext(
    segmentsProp === undefined,
    limit,
    compactAt,
    rootRef
  );
  const isDemo = segmentsProp === undefined;
  const segments = segmentsProp ?? demo.segments;
  const colors = segments.map(
    (segment, index) =>
      segment.color ??
      (isDemo
        ? DEMO_COLORS[segment.id]
        : FALLBACK_COLORS[
            Math.max(0, FALLBACK_COLORS.length - segments.length + index)
          ])
  );

  const used = segments.reduce((sum, segment) => sum + segment.tokens, 0);
  const share = used / limit;
  const shownShare = useTweened(share);
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Closes on Escape or a press outside, like any popover.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Focus inside the panel would be lost with it; hand it back.
        if (rootRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus();
        }
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleCompact = isDemo ? demo.compact : onCompact;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-sm", className)} ref={rootRef}>
        <div className="relative flex h-11 items-center justify-between rounded-xl bg-black/5 pr-1.5 pl-3 dark:bg-white/5">
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            {model}
          </span>
          <button
            aria-controls={panelId}
            aria-expanded={open}
            aria-label={`Context ${Math.round(share * 100)}% full. Show breakdown`}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs outline-hidden transition-colors duration-150 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:bg-white/10",
              open && "bg-black/5 dark:bg-white/10",
              levelColor(share, compactAt)
            )}
            onClick={() => setOpen((value) => !value)}
            ref={triggerRef}
            type="button"
          >
            <Ring share={shownShare} />
            <span className="font-medium tabular-nums">
              {Math.round(shownShare * 100)}%
            </span>
          </button>
          {/* After the trigger in the DOM, so Tab moves from it into the
            panel, which still opens above. */}
          <AnimatePresence>
            {open && (
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 bottom-full z-10 mb-2 origin-bottom-right rounded-xl bg-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                id={panelId}
                initial={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.16, ease: EASE_OUT }}
              >
                <Breakdown
                  colors={colors}
                  compactAt={compactAt}
                  limit={limit}
                  onCompact={handleCompact}
                  segments={segments}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
