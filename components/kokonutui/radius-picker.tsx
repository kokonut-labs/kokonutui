"use client";

/**
 * @author: @dorianbaffier
 * @description: Radius Picker
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type Variants,
} from "motion/react";
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
const DEFAULT_STOPS = [0.5, 1, 2, 5, 10, 25];
/** The ring's radius at the smallest and largest stop, as a share of the map. */
const RING_MIN = 0.15;
const RING_MAX = 0.41;
const MAP_HEIGHT = 260;

export interface RadiusPickerProps {
  /** Where the search is centred, shown in the header. */
  place?: string;
  /** What is being searched for, plural, e.g. "homes". */
  noun?: string;
  /** Radii to choose from, in km, smallest first. */
  stops?: number[];
  defaultRadius?: number;
  /** Result positions in km from the centre, east and north. */
  results?: { x: number; y: number }[];
  onChange?: (km: number) => void;
  className?: string;
}

// A small integer generator so the demo results land in the same places on
// every load and every machine.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

function demoResults(count = 64) {
  const random = seeded(7);
  return Array.from({ length: count }, () => {
    // More places close in than far out, like a city thinning toward its edge.
    const distance = 0.3 * 100 ** random();
    const angle = random() * Math.PI * 2;
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  });
}

const formatKm = (km: number) => {
  if (km < 1) {
    return `${Math.round((km * 1000) / 50) * 50} m`;
  }
  return km < 10
    ? `${km.toFixed(1).replace(".0", "")} km`
    : `${Math.round(km)} km`;
};

export default function RadiusPicker({
  place = "Mission District",
  noun = "homes",
  stops = DEFAULT_STOPS,
  defaultRadius = 2,
  results,
  onChange,
  className,
}: RadiusPickerProps) {
  const min = stops[0];
  const max = stops.at(-1) ?? min * 10;
  const tOf = (km: number) => Math.log(km / min) / Math.log(max / min);
  const kmOf = (t: number) => min * (max / min) ** t;

  const [t, setT] = useState(() => tOf(defaultRadius));
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [angle, setAngle] = useState(-Math.PI / 5);
  const [dragging, setDragging] = useState(false);
  const reduceMotion = useReducedMotion();

  const frameRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(t);
  useMotionValueEvent(progress, "change", setT);

  const places = useMemo(() => results ?? demoResults(), [results]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setSize({ w: frame.clientWidth, h: frame.clientHeight })
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const km = kmOf(t);
  const inside = places.filter((p) => Math.hypot(p.x, p.y) <= km).length;

  const short = size ? Math.min(size.w, size.h) : MAP_HEIGHT;
  const ringPx = short * (RING_MIN + (RING_MAX - RING_MIN) * t);
  // Pixels per km: the ring grows a little while the map zooms out under it.
  const scale = ringPx / km;
  const cx = (size?.w ?? 0) / 2;
  const cy = (size?.h ?? MAP_HEIGHT) / 2;

  const goTo = (target: number) => {
    const next = tOf(target);
    animate(
      progress,
      next,
      reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 32 }
    );
    onChange?.(target);
  };

  const nearestStop = (value: number) =>
    stops.reduce((best, stop) =>
      Math.abs(tOf(stop) - value) < Math.abs(tOf(best) - value) ? stop : best
    );

  const pointerAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - cx,
      y: event.clientY - rect.top - cy,
    };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (!target.closest("[data-ring]") || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    progress.stop();
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) {
      return;
    }
    const { x, y } = pointerAt(event);
    const distance = Math.hypot(x, y) / short;
    const next = (distance - RING_MIN) / (RING_MAX - RING_MIN);
    progress.set(Math.min(1, Math.max(0, next)));
    setAngle(Math.atan2(y, x));
  };

  const onPointerUp = () => {
    if (!dragging) {
      return;
    }
    setDragging(false);
    goTo(nearestStop(progress.get()));
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const index = stops.indexOf(nearestStop(t));
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[
      event.key
    ];
    let next = index;
    if (step) {
      next = Math.min(stops.length - 1, Math.max(0, index + step));
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = stops.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    goTo(stops[next]);
  };

  const handle = {
    x: cx + Math.cos(angle) * ringPx,
    y: cy + Math.sin(angle) * ringPx,
  };
  // The readout sits just outside the ring, past the handle.
  const label = {
    x: cx + Math.cos(angle) * (ringPx + 26),
    y: cy + Math.sin(angle) * (ringPx + 26),
  };
  const activeStop = nearestStop(t);
  const settled = Math.abs(tOf(activeStop) - t) < 0.002;

  return (
    <div
      className={cn(
        "w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-end justify-between gap-4 p-5 pb-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            Within {settled ? formatKm(activeStop) : formatKm(km)} of {place}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5 font-semibold text-2xl text-zinc-900 tracking-tight dark:text-zinc-50">
            <RollingNumber
              reduceMotion={Boolean(reduceMotion)}
              value={inside}
            />
            <span>{noun}</span>
          </p>
        </div>
      </div>

      <div
        className="relative border-zinc-200 border-y bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60"
        ref={frameRef}
        style={{ height: MAP_HEIGHT }}
      >
        {size && (
          <svg
            className={cn(
              "absolute inset-0 size-full touch-none select-none",
              dragging && "cursor-grabbing"
            )}
            onLostPointerCapture={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            viewBox={`0 0 ${size.w} ${size.h}`}
          >
            <title>{`Search area: ${formatKm(km)} around ${place}`}</title>
            <Streets cx={cx} cy={cy} scale={scale} />

            {places.map((p, i) => {
              const px = cx + p.x * scale;
              const py = cy - p.y * scale;
              if (px < -8 || py < -8 || px > size.w + 8 || py > size.h + 8) {
                return null;
              }
              const isIn = Math.hypot(p.x, p.y) <= km;
              return (
                <circle
                  className={cn(
                    "transition-[fill,stroke] duration-150",
                    isIn
                      ? "fill-zinc-900 stroke-white dark:fill-zinc-100 dark:stroke-zinc-900"
                      : "fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600"
                  )}
                  cx={px}
                  cy={py}
                  // biome-ignore lint/suspicious/noArrayIndexKey: results have no ids and never reorder
                  key={i}
                  r={isIn ? 3.5 : 3}
                  strokeWidth={1.5}
                />
              );
            })}

            <circle
              className="fill-zinc-900/[0.04] stroke-zinc-900 dark:fill-zinc-100/[0.05] dark:stroke-zinc-100"
              cx={cx}
              cy={cy}
              pointerEvents="none"
              r={ringPx}
              strokeWidth={1.5}
            />
            {/* A wide clear stroke so the whole ring can be grabbed. */}
            <circle
              className="cursor-grab fill-none stroke-transparent"
              cx={cx}
              cy={cy}
              data-ring
              r={ringPx}
              strokeWidth={18}
            />

            <circle
              className="fill-orange-500 stroke-white dark:stroke-zinc-900"
              cx={cx}
              cy={cy}
              r={5}
              strokeWidth={2.5}
            />

            <g
              aria-label="Search radius"
              aria-valuemax={max}
              aria-valuemin={min}
              aria-valuenow={Number(km.toFixed(1))}
              aria-valuetext={formatKm(km)}
              className="group/handle cursor-grab outline-none"
              data-ring
              onKeyDown={onKeyDown}
              role="slider"
              tabIndex={0}
            >
              <circle
                className="fill-transparent"
                cx={handle.x}
                cy={handle.y}
                r={18}
              />
              <circle
                className={cn(
                  "fill-white stroke-zinc-900 transition-[stroke-width] duration-150 dark:fill-zinc-950 dark:stroke-zinc-100",
                  "group-focus-visible/handle:stroke-[4px]"
                )}
                cx={handle.x}
                cy={handle.y}
                r={dragging ? 8 : 7}
                strokeWidth={2}
              />
            </g>
          </svg>
        )}

        {size && (
          <span
            className={cn(
              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[11px] tabular-nums transition-colors duration-150",
              dragging
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-white text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.08)] dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1)]"
            )}
            style={{
              left: Math.min(size.w - 28, Math.max(28, label.x)),
              top: Math.min(size.h - 12, Math.max(12, label.y)),
            }}
          >
            {formatKm(km)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 p-3">
        {stops.map((stop) => {
          const isActive = settled && stop === activeStop;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "h-8 flex-1 rounded-full font-medium text-xs tabular-nums outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-zinc-400",
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
              key={stop}
              onClick={() => goTo(stop)}
              type="button"
            >
              {formatKm(stop)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A drawn street map in km, redrawn at the current zoom. Side streets fade
 * out as the map zooms out, leaving the avenues and the river.
 */
function Streets({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  // Each level of road fades out once its lines would crowd together.
  const fade = (from: number, span: number) =>
    Math.min(1, Math.max(0, (scale - from) / span));
  const local = useMemo(() => grid(10, 0.25), []);
  const avenues = useMemo(() => grid(40, 2), []);
  const highways = useMemo(() => grid(80, 10), []);

  return (
    <g
      fill="none"
      strokeLinecap="round"
      transform={`translate(${cx} ${cy}) scale(${scale}) rotate(-12)`}
    >
      {/* Park and river first, under the streets. */}
      <rect
        className="fill-emerald-500/10 dark:fill-emerald-400/10"
        height={0.9}
        rx={0.05}
        width={1.1}
        x={0.55}
        y={-1.6}
      />
      <path
        className="stroke-sky-100 dark:stroke-sky-950"
        d="M -80 3.2 C -20 1.6, -8 5.4, 0 3.6 S 18 0.8, 80 4.4"
        strokeWidth={0.32}
      />
      <Roads
        className="stroke-zinc-200 dark:stroke-zinc-800"
        extent={10}
        lines={local}
        opacity={fade(25, 30)}
        width={1}
      />
      <Roads
        className="stroke-zinc-300 dark:stroke-zinc-700"
        extent={40}
        lines={avenues}
        opacity={fade(6, 10)}
        width={1.5}
      />
      <Roads
        className="stroke-zinc-300 dark:stroke-zinc-700"
        extent={80}
        lines={highways}
        opacity={1}
        width={2}
      />
      <g className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={2}>
        <line
          vectorEffect="non-scaling-stroke"
          x1={-80}
          x2={80}
          y1={-60}
          y2={60}
        />
        <line
          vectorEffect="non-scaling-stroke"
          x1={-60}
          x2={72}
          y1={80}
          y2={-80}
        />
      </g>
    </g>
  );
}

const grid = (extent: number, step: number) => {
  const lines: number[] = [];
  for (let k = -extent; k <= extent; k += step) {
    lines.push(Number(k.toFixed(2)));
  }
  return lines;
};

function Roads({
  lines,
  extent,
  opacity,
  width,
  className,
}: {
  lines: number[];
  extent: number;
  opacity: number;
  width: number;
  className: string;
}) {
  if (opacity === 0) {
    return null;
  }
  return (
    <g className={className} opacity={opacity} strokeWidth={width}>
      {lines.map((k) => (
        <g key={k}>
          <line
            vectorEffect="non-scaling-stroke"
            x1={k}
            x2={k}
            y1={-extent}
            y2={extent}
          />
          <line
            vectorEffect="non-scaling-stroke"
            x1={-extent}
            x2={extent}
            y1={k}
            y2={k}
          />
        </g>
      ))}
    </g>
  );
}

const roll = {
  enter: (direction: number) => ({ y: direction * 14, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction * -14, opacity: 0 }),
} satisfies Variants;

/** Each digit rolls on its own, up when the count grows and down when it drops. */
function RollingNumber({
  value,
  reduceMotion,
}: {
  value: number;
  reduceMotion: boolean;
}) {
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  previous.current = value;
  const digits = [...String(value)];

  return (
    <span className="inline-flex tabular-nums">
      {digits.map((digit, i) => (
        <span
          className="relative inline-flex overflow-hidden"
          key={`place-${digits.length - i}`}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.span
              animate="center"
              custom={direction}
              exit="exit"
              initial="enter"
              key={digit}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.2, ease: EASE_OUT }
              }
              variants={roll}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
