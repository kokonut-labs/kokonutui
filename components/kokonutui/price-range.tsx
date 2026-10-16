"use client";

/**
 * @author: @dorianbaffier
 * @description: Price Range
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Range = [number, number];
type Handle = 0 | 1;

export interface PriceRangeProps {
  /** Every price in the result set; the histogram and count come from it. */
  prices?: number[];
  min?: number;
  /** Prices above this land in the last bar, and the max reads "$500+". */
  max?: number;
  step?: number;
  bins?: number;
  defaultValue?: Range;
  value?: Range;
  onValueChange?: (value: Range) => void;
  currency?: string;
  locale?: string;
  label?: string;
  description?: string;
  /** What the count is counting, e.g. "stays" or "results". */
  noun?: string;
  className?: string;
}

// Seeded (Park-Miller) so the server and the client draw the same demo
// histogram.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

function demoPrices() {
  const random = seededRandom(7);
  const prices: number[] = [];
  for (let i = 0; i < 640; i++) {
    // Nightly rates are roughly log-normal: lots around the median, a
    // long tail of expensive places.
    const z =
      Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
    prices.push(Math.round(Math.exp(Math.log(150) + 0.55 * z)));
  }
  return prices;
}

const DEMO_PRICES = demoPrices();

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

export default function PriceRange({
  prices = DEMO_PRICES,
  min = 20,
  max = 500,
  step = 5,
  bins = 40,
  defaultValue = [80, 320],
  value: controlled,
  onValueChange,
  currency = "USD",
  locale = "en-US",
  label = "Price range",
  description = "Nightly prices before fees and taxes",
  noun = "stays",
  className,
}: PriceRangeProps) {
  const [uncontrolled, setUncontrolled] = useState<Range>(defaultValue);
  const value = controlled ?? uncontrolled;
  const [dragging, setDragging] = useState<Handle | "band" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<{ handle: Handle | "band"; x: number; start: Range }>(
    null
  );
  const id = useId();
  const reduceMotion = useReducedMotion();

  const span = max - min;
  const toRatio = (v: number) => (v - min) / span;

  const format = useMemo(() => {
    const f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    return (v: number) => (v >= max ? `${f.format(max)}+` : f.format(v));
  }, [locale, currency, max]);

  const histogram = useMemo(() => {
    const counts = new Array<number>(bins).fill(0);
    for (const price of prices) {
      const bin = Math.floor(clamp((price - min) / span, 0, 0.9999) * bins);
      counts[bin] += 1;
    }
    return { counts, peak: Math.max(...counts, 1) };
  }, [prices, bins, min, span]);

  const count = useMemo(
    () =>
      prices.filter(
        (price) => price >= value[0] && (value[1] >= max || price <= value[1])
      ).length,
    [prices, value, max]
  );

  const setValue = (next: Range) => {
    if (next[0] === value[0] && next[1] === value[1]) {
      return;
    }
    setUncontrolled(next);
    onValueChange?.(next);
  };

  const snap = (v: number) =>
    clamp(min + Math.round((v - min) / step) * step, min, max);

  const moveHandle = (handle: Handle, v: number) => {
    const next: Range = [...value];
    next[handle] =
      handle === 0
        ? clamp(snap(v), min, value[1] - step)
        : clamp(snap(v), value[0] + step, max);
    setValue(next);
  };

  const valueAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return min;
    }
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * span;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const part = (event.target as HTMLElement).dataset.part;
    const v = valueAt(event.clientX);
    let handle: Handle | "band";
    if (part === "band") {
      handle = "band";
    } else if (part === "thumb-0" || part === "thumb-1") {
      handle = part === "thumb-0" ? 0 : 1;
    } else {
      // A press anywhere else grabs the nearest thumb and jumps it there.
      handle = Math.abs(v - value[0]) <= Math.abs(v - value[1]) ? 0 : 1;
      moveHandle(handle, v);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { handle, x: event.clientX, start: value };
    setDragging(handle);
    if (handle !== "band") {
      thumbRefs.current[handle]?.focus({ focusVisible: false } as FocusOptions);
    }
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    if (drag.handle === "band") {
      // Dragging between the thumbs slides the whole window and keeps
      // its width, for "same budget, a bit cheaper".
      const width = drag.start[1] - drag.start[0];
      const delta = valueAt(event.clientX) - valueAt(drag.x);
      const lo = clamp(snap(drag.start[0] + delta), min, max - width);
      setValue([lo, lo + width]);
      return;
    }
    moveHandle(drag.handle, valueAt(event.clientX));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };

  const onKeyDown = (handle: Handle) => (event: KeyboardEvent) => {
    const big = step * 10;
    const deltas: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -big,
      PageUp: big,
    };
    let next: number | undefined;
    if (event.key in deltas) {
      next = value[handle] + deltas[event.key] * (event.shiftKey ? 10 : 1);
    } else if (event.key === "Home") {
      next = min;
    } else if (event.key === "End") {
      next = max;
    }
    if (next !== undefined) {
      event.preventDefault();
      moveHandle(handle, next);
    }
  };

  const lo = toRatio(value[0]) * 100;
  const hi = toRatio(value[1]) * 100;

  return (
    <fieldset
      aria-labelledby={`${id}-label`}
      className={cn(
        "w-full min-w-0 max-w-md select-none rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium text-sm" id={`${id}-label`}>
          {label}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <RollingNumber reduceMotion={!!reduceMotion} value={count} /> {noun}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>

      <div
        className="relative mt-6 cursor-pointer touch-none"
        onLostPointerCapture={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <div aria-hidden className="flex h-20 items-end gap-[2px]">
          {histogram.counts.map((n, i) => {
            const center = min + ((i + 0.5) / bins) * span;
            const inside =
              center >= value[0] && (value[1] >= max || center <= value[1]);
            return (
              <div
                className={cn(
                  "min-h-[2px] flex-1 rounded-t-[2px] transition-colors duration-150 ease-out",
                  inside
                    ? "bg-zinc-900 dark:bg-zinc-100"
                    : "bg-zinc-200 dark:bg-zinc-800"
                )}
                // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional and never reorder
                key={i}
                style={{ height: `${(n / histogram.peak) * 100}%` }}
              />
            );
          })}
        </div>

        <div className="relative h-6" ref={trackRef}>
          <div className="absolute inset-x-0 top-0 h-px bg-zinc-200 dark:bg-zinc-800" />
          <div
            className={cn(
              "absolute top-0 h-full",
              dragging === "band" ? "cursor-grabbing" : "cursor-grab"
            )}
            data-part="band"
            style={{ left: `${lo}%`, right: `${100 - hi}%` }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] -translate-y-1/2 bg-zinc-900 dark:bg-zinc-100" />
          </div>
          {([0, 1] as const).map((handle) => (
            <div
              aria-label={handle === 0 ? "Minimum price" : "Maximum price"}
              aria-orientation="horizontal"
              aria-valuemax={max}
              aria-valuemin={min}
              aria-valuenow={value[handle]}
              aria-valuetext={format(value[handle])}
              className={cn(
                "absolute top-0 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-300 bg-white shadow-sm outline-none",
                "transition-[box-shadow,border-color] duration-150 ease-out",
                "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-100 dark:focus-visible:ring-offset-zinc-950",
                dragging === handle
                  ? "cursor-grabbing border-zinc-900 shadow-md dark:border-white"
                  : "cursor-grab hover:border-zinc-400"
              )}
              data-part={`thumb-${handle}`}
              key={handle}
              onKeyDown={onKeyDown(handle)}
              ref={(node) => {
                thumbRefs.current[handle] = node;
              }}
              role="slider"
              style={{ left: `${handle === 0 ? lo : hi}%` }}
              tabIndex={0}
            />
          ))}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PriceField
          format={format}
          label="Minimum"
          onCommit={(v) => moveHandle(0, v)}
          value={value[0]}
        />
        <span aria-hidden className="h-px w-3 bg-zinc-300 dark:bg-zinc-700" />
        <PriceField
          format={format}
          label="Maximum"
          onCommit={(v) => moveHandle(1, v)}
          value={value[1]}
        />
      </div>
    </fieldset>
  );
}

function PriceField({
  label,
  value,
  format,
  onCommit,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  const commit = () => {
    if (draft !== null) {
      const parsed = Number.parseInt(draft.replace(/[^\d]/g, ""), 10);
      if (!Number.isNaN(parsed)) {
        onCommit(parsed);
      }
    }
    setDraft(null);
  };

  return (
    <label
      className="block cursor-text rounded-xl border border-zinc-200 px-3 py-2 transition-colors duration-150 focus-within:border-zinc-900 dark:border-zinc-800 dark:focus-within:border-zinc-100"
      htmlFor={id}
    >
      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <input
        className="w-full bg-transparent font-medium text-sm tabular-nums outline-none"
        id={id}
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          setDraft(String(value));
          requestAnimationFrame(() => event.target.select());
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
            requestAnimationFrame(() => event.currentTarget?.blur());
          }
        }}
        type="text"
        value={draft ?? format(value)}
      />
    </label>
  );
}

function RollingNumber({
  value,
  reduceMotion,
}: {
  value: number;
  reduceMotion: boolean;
}) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (v) =>
    Math.round(v).toLocaleString("en-US")
  );

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.35,
      ease: [0.23, 1, 0.32, 1],
    });
    return () => controls.stop();
  }, [value, motionValue, reduceMotion]);

  return (
    <motion.span className="font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
      {text}
    </motion.span>
  );
}
