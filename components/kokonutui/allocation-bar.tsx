"use client";

/**
 * @author: @dorianbaffier
 * @description: Allocation Bar
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, motion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Smallest share anyone can be left with, in percent. */
const MIN_SHARE = 2;
/** Shares stick to multiples of 5 when they come this close, in percent. */
const SNAP_RANGE = 1.2;
/** Under this width a segment shows its share above the bar instead. */
const INSIDE_LABEL_MIN = 40;
/** Closest two shares above the bar can sit, centre to centre, in px. */
const OUTSIDE_LABEL_GAP = 30;

export interface AllocationPart {
  id: string;
  name: string;
  /** Tailwind background class for the segment and legend dot. */
  color: string;
}

export interface AllocationBarProps {
  title?: string;
  /** The amount being split, in major units (e.g. dollars). */
  total?: number;
  currency?: string;
  parts?: AllocationPart[];
  /** Starting shares in percent, one per part. Defaults to an even split. */
  defaultShares?: number[];
  onChange?: (shares: number[]) => void;
  className?: string;
}

const DEFAULT_PARTS: AllocationPart[] = [
  { id: "maya", name: "Maya", color: "bg-orange-500" },
  { id: "leo", name: "Leo", color: "bg-sky-500" },
  { id: "sam", name: "Sam", color: "bg-emerald-500" },
  { id: "priya", name: "Priya", color: "bg-violet-500" },
];

const evenBounds = (count: number) =>
  Array.from({ length: count - 1 }, (_, i) => ((i + 1) * 100) / count);

const boundsFromShares = (shares: number[]) => {
  const bounds: number[] = [];
  let sum = 0;
  for (const share of shares.slice(0, -1)) {
    sum += share;
    bounds.push(sum);
  }
  return bounds;
};

const sharesFromBounds = (bounds: number[]) =>
  [...bounds, 100].map((bound, i) => bound - (i === 0 ? 0 : bounds[i - 1]));

function snap(value: number) {
  const nearest = Math.round(value / 5) * 5;
  return Math.abs(nearest - value) <= SNAP_RANGE
    ? nearest
    : Math.round(value * 2) / 2;
}

/**
 * Moves one divider and shoves the others out of its way, measured from where
 * they stood when the drag began, so backing off lets them return.
 */
function push(start: number[], index: number, target: number) {
  const count = start.length;
  const low = (index + 1) * MIN_SHARE;
  const high = 100 - (count - index) * MIN_SHARE;
  const next = [...start];
  next[index] = Math.min(high, Math.max(low, target));
  for (let j = index + 1; j < count; j++) {
    next[j] = Math.max(start[j], next[j - 1] + MIN_SHARE);
  }
  for (let j = index - 1; j >= 0; j--) {
    next[j] = Math.min(start[j], next[j + 1] - MIN_SHARE);
  }
  return next;
}

/**
 * Splits the total into cents by largest remainder, so the rows always add up
 * to the exact total instead of drifting a cent either way.
 */
function splitCents(total: number, shares: number[]) {
  const cents = Math.round(total * 100);
  const raw = shares.map((share) => (cents * share) / 100);
  const floors = raw.map(Math.floor);
  let left = cents - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, i) => ({ i, rest: value - floors[i] }))
    .sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) {
      break;
    }
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((value) => value / 100);
}

const formatShare = (share: number) =>
  `${Number.isInteger(share) ? share : share.toFixed(1)}%`;

export default function AllocationBar({
  title = "Split the bill",
  total = 248.6,
  currency = "$",
  parts = DEFAULT_PARTS,
  defaultShares,
  onChange,
  className,
}: AllocationBarProps) {
  const [bounds, setBounds] = useState(() =>
    defaultShares ? boundsFromShares(defaultShares) : [40, 65, 85]
  );
  const [active, setActive] = useState<number | null>(null);
  const [gliding, setGliding] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ start: number[]; index: number } | null>(null);
  const glideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const shares = useMemo(() => sharesFromBounds(bounds), [bounds]);
  const amounts = useMemo(() => splitCents(total, shares), [total, shares]);
  const [barWidth, setBarWidth] = useState(320);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }
    const observer = new ResizeObserver(() => setBarWidth(bar.offsetWidth));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const money = (value: number) =>
    `${currency}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const commit = (next: number[], glide: boolean) => {
    setGliding(glide);
    clearTimeout(glideTimer.current);
    if (glide) {
      glideTimer.current = setTimeout(() => setGliding(false), 360);
    }
    setBounds(next);
    onChange?.(sharesFromBounds(next));
  };

  const percentAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const onPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    index: number
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    dragRef.current = { start: bounds, index };
    setActive(index);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    commit(push(drag.start, drag.index, snap(percentAt(event.clientX))), false);
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setActive(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const step = event.shiftKey ? 5 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: bounds[index] - step,
      ArrowDown: bounds[index] - step,
      ArrowRight: bounds[index] + step,
      ArrowUp: bounds[index] + step,
      Home: 0,
      End: 100,
    };
    if (event.key in moves) {
      event.preventDefault();
      commit(push(bounds, index, Math.round(moves[event.key])), true);
    }
  };

  const evenOut = () => commit(evenBounds(parts.length), true);

  // Thin segments show their share above the bar, skipping any that would
  // land on top of the one before.
  const outsideLabels = useMemo(() => {
    let lastShown = Number.NEGATIVE_INFINITY;
    return shares.map((share, i) => {
      const start = i === 0 ? 0 : bounds[i - 1];
      const centre = ((start + share / 2) / 100) * barWidth;
      const thin = (share / 100) * barWidth < INSIDE_LABEL_MIN;
      if (!thin || centre - lastShown < OUTSIDE_LABEL_GAP) {
        return false;
      }
      lastShown = centre;
      return true;
    });
  }, [shares, bounds, barWidth]);

  const isEven = bounds.every(
    (bound, i) => Math.abs(bound - evenBounds(parts.length)[i]) < 0.01
  );

  const position = gliding
    ? "transition-[left,width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
    : "";

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="mt-0.5 font-semibold text-2xl text-zinc-900 tabular-nums tracking-tight dark:text-zinc-50">
            {money(total)}
          </p>
        </div>
        <button
          className={cn(
            "h-8 shrink-0 rounded-full border px-3 font-medium text-xs transition-colors duration-150",
            "border-zinc-200 dark:border-zinc-800",
            isEven
              ? "cursor-default text-zinc-400 dark:text-zinc-600"
              : "text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800 dark:hover:bg-zinc-900"
          )}
          disabled={isEven}
          onClick={evenOut}
          type="button"
        >
          Split evenly
        </button>
      </div>

      {/* Room above the bar for the shares of segments too thin to hold one. */}
      <div className="relative mt-9">
        <div className="relative h-12 select-none" ref={barRef}>
          {parts.map((part, i) => {
            const left = i === 0 ? 0 : bounds[i - 1];
            const width = shares[i];
            const inside = (width / 100) * barWidth >= INSIDE_LABEL_MIN;
            const above = outsideLabels[i] && active === null;
            return (
              <div
                className={cn("absolute inset-y-0", position)}
                key={part.id}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[10px]",
                    i === 0 ? "left-0" : "left-[1.5px]",
                    i === parts.length - 1 ? "right-0" : "right-[1.5px]",
                    part.color
                  )}
                >
                  <span
                    className={cn(
                      "font-medium text-white text-xs tabular-nums transition-opacity duration-150",
                      inside ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {formatShare(width)}
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {above && (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap font-medium text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400"
                      exit={{ opacity: 0, y: 4 }}
                      initial={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.16, ease: EASE_OUT }}
                    >
                      {formatShare(width)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {bounds.map((bound, i) => {
            const left = parts[i];
            const right = parts[i + 1];
            const isActive = active === i;
            return (
              <div
                aria-label={`Between ${left.name} and ${right.name}`}
                aria-orientation="horizontal"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(bound)}
                aria-valuetext={`${left.name} ${formatShare(shares[i])}, ${right.name} ${formatShare(shares[i + 1])}`}
                className={cn(
                  "group/divider absolute inset-y-[-6px] z-10 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none",
                  position
                )}
                key={left.id}
                onDoubleClick={evenOut}
                onKeyDown={(event) => onKeyDown(event, i)}
                onLostPointerCapture={onPointerUp}
                onPointerDown={(event) => onPointerDown(event, i)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                role="slider"
                style={{ left: `${bound}%` }}
                tabIndex={0}
              >
                <span
                  className={cn(
                    "h-7 w-1 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_1px_3px_rgb(0_0_0/0.25)] transition-[height] duration-150 ease-out",
                    "group-hover/divider:h-9 group-focus-visible/divider:h-9 group-focus-visible/divider:ring-2 group-focus-visible/divider:ring-zinc-400",
                    isActive && "h-9"
                  )}
                />
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      className="pointer-events-none absolute bottom-full mb-2 flex items-center gap-1 whitespace-nowrap rounded-md bg-zinc-900 px-1.5 py-1 font-medium text-[11px] text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900"
                      exit={{ opacity: 0, y: 3, transition: { duration: 0.1 } }}
                      initial={{ opacity: 0, y: 3 }}
                      transition={{ duration: 0.14, ease: EASE_OUT }}
                    >
                      {formatShare(shares[i])}
                      <span className="text-white/40 dark:text-zinc-900/40">
                        |
                      </span>
                      {formatShare(shares[i + 1])}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-6 divide-y divide-zinc-100 dark:divide-zinc-900">
        {parts.map((part, i) => (
          <li className="flex items-center gap-3 py-2.5 text-sm" key={part.id}>
            <span className={cn("size-2.5 rounded-full", part.color)} />
            <span className="flex-1 text-zinc-900 dark:text-zinc-100">
              {part.name}
            </span>
            <span className="w-12 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
              {formatShare(shares[i])}
            </span>
            <span className="w-20 text-right font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
              {money(amounts[i])}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 flex justify-between border-zinc-200 border-t border-dashed pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>Drag a divider, or double-click it to split evenly</span>
        <span className="tabular-nums">
          {money(amounts.reduce((a, b) => a + b, 0))}
        </span>
      </p>
    </div>
  );
}
