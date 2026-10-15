"use client";

/**
 * @author: @dorianbaffier
 * @description: Metric Card
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// The chart's drawing box; it stretches to the card's width.
const W = 400;
const H = 120;
const PAD_Y = 10;
// Every period is resampled to this many points, so one shape can morph
// into another.
const SAMPLES = 90;
const MORPH_MS = 420;
const DAY = 86_400_000;
const DIGIT = /\d/;

export interface MetricPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface MetricCardProps {
  label?: string;
  /** Daily values, oldest first. Needs twice the longest period, so each period has one to compare with. */
  data?: MetricPoint[];
  periods?: number[];
  defaultPeriod?: number;
  /** "currency" sums the period; "number" sums it too, without a symbol. */
  format?: "currency" | "number";
  currency?: string;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Seeded, so server and browser draw the same chart.
function demoData(days: number, end: string): MetricPoint[] {
  let seed = 42;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  const last = Date.parse(`${end}T00:00:00Z`);
  const out: MetricPoint[] = [];
  let level = 1180;
  for (let i = 0; i < days; i++) {
    const t = last - (days - 1 - i) * DAY;
    const weekday = new Date(t).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    level += 3.4 + (random() - 0.5) * 30;
    const promo = i > days - 40 && i < days - 34 ? 1.22 : 1;
    const value =
      level * (weekend ? 0.86 : 1) * promo * (0.94 + random() * 0.12);
    out.push({
      date: new Date(t).toISOString().slice(0, 10),
      value: Math.round(value),
    });
  }
  return out;
}

const DEFAULT_DATA = demoData(180, "2026-10-14");

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const formatShort = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Linear resample of `values` to `count` evenly spaced points. */
function resample(values: number[], count: number) {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const at = (i / (count - 1)) * (values.length - 1);
    const lo = Math.floor(at);
    const hi = Math.min(values.length - 1, lo + 1);
    out[i] = values[lo] + (values[hi] - values[lo]) * (at - lo);
  }
  return out;
}

/** Heights 0..1 to an SVG path, smoothed with a Catmull-Rom spline. */
function toPath(heights: number[]) {
  const pts = heights.map((h, i) => [
    (i / (heights.length - 1)) * W,
    PAD_Y + (1 - h) * (H - PAD_Y * 2),
  ]);
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

interface Shape {
  current: number[];
  previous: number[];
}

interface Paths {
  current: string;
  previous: string;
}

/** One period's numbers and its shape, normalised to the same scale. */
function buildPeriod(data: MetricPoint[], days: number) {
  const current = data.slice(-days);
  const previous = data.slice(-days * 2, -days);
  const values = [...current, ...previous].map((p) => p.value);
  const lo = Math.min(...values) * 0.92;
  const hi = Math.max(...values) * 1.04;
  const norm = (v: number) => (v - lo) / (hi - lo || 1);
  const total = current.reduce((s, p) => s + p.value, 0);
  const before = previous.reduce((s, p) => s + p.value, 0);
  return {
    current,
    previous,
    total,
    before,
    // Resampled to a common length for morphing between periods.
    shape: {
      current: resample(
        current.map((p) => norm(p.value)),
        SAMPLES
      ),
      previous: resample(
        previous.map((p) => norm(p.value)),
        SAMPLES
      ),
    } as Shape,
    // Drawn through the real days once it lands, so the dots sit on it.
    paths: {
      current: toPath(current.map((p) => norm(p.value))),
      previous: toPath(previous.map((p) => norm(p.value))),
    } as Paths,
    norm,
  };
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Each digit rolls on its own wheel; separators sit still. */
function RollingNumber({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // Keyed from the right, so units stay put when the length changes.
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          return <span key={`s${key}`}>{char}</span>;
        }
        return (
          <span
            className="relative inline-block h-[1em] overflow-hidden leading-none"
            key={`d${key}`}
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[380ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(char) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span className="block h-[1em] leading-none" key={d}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function MetricCard({
  label = "Revenue",
  data = DEFAULT_DATA,
  periods = [7, 30, 90],
  defaultPeriod = 30,
  format = "currency",
  currency = "USD",
  className,
}: MetricCardProps) {
  const clipId = `${useId().replace(/:/g, "")}-past`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [scrub, setScrub] = useState<number | null>(null);
  const info = useMemo(() => buildPeriod(data, period), [data, period]);

  const currentRef = useRef<SVGPathElement>(null);
  const currentDimRef = useRef<SVGPathElement>(null);
  const previousRef = useRef<SVGPathElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const shown = useRef<Shape>(info.shape);
  const morph = useRef({ raf: 0 });

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: format === "currency" ? "currency" : "decimal",
        currency,
        maximumFractionDigits: 0,
      }),
    [format, currency]
  );

  // A new period morphs the lines from where they are now.
  useEffect(() => {
    const from = shown.current;
    const to = info.shape;
    const m = morph.current;
    cancelAnimationFrame(m.raf);
    const paint = (paths: Paths) => {
      currentRef.current?.setAttribute("d", paths.current);
      currentDimRef.current?.setAttribute("d", paths.current);
      previousRef.current?.setAttribute("d", paths.previous);
    };
    const land = () => {
      shown.current = to;
      paint(info.paths);
    };
    if (
      from === to ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      land();
      return;
    }
    const start = performance.now();
    const frame = (now: number) => {
      const t = easeInOut(Math.min(1, (now - start) / MORPH_MS));
      const mix = (a: number[], b: number[]) =>
        a.map((v, i) => v + (b[i] - v) * t);
      shown.current = {
        current: mix(from.current, to.current),
        previous: mix(from.previous, to.previous),
      };
      if (t < 1) {
        paint({
          current: toPath(shown.current.current),
          previous: toPath(shown.current.previous),
        });
        m.raf = requestAnimationFrame(frame);
      } else {
        land();
      }
    };
    m.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(m.raf);
  }, [info.shape, info.paths]);

  const indexAt = useCallback(
    (clientX: number) => {
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) {
        return 0;
      }
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      return Math.round(t * (info.current.length - 1));
    },
    [info.current.length]
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrub(indexAt(event.clientX));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Mouse scrubs on hover; touch only while pressed.
    if (
      event.pointerType === "mouse" ||
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      setScrub(indexAt(event.clientX));
    }
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      setScrub(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = info.current.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -last,
      End: last,
    };
    if (event.key === "Escape") {
      setScrub(null);
      return;
    }
    const move = moves[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    setScrub((at) => clamp((at ?? last) + move, 0, last));
  };

  const choose = (days: number) => {
    setScrub(null);
    setPeriod(days);
  };

  const scrubbing = scrub !== null && scrub < info.current.length;
  const point = scrubbing ? info.current[scrub] : null;
  const twin = scrubbing ? info.previous[scrub] : null;
  const value = point ? point.value : info.total;
  const compare = twin ? twin.value : info.before;
  const delta = compare ? (value - compare) / compare : 0;
  const up = delta >= 0;
  const x = scrubbing ? (scrub / (info.current.length - 1)) * 100 : 100;
  const y = point ? PAD_Y + (1 - info.norm(point.value)) * (H - PAD_Y * 2) : 0;
  const yPrev = twin
    ? PAD_Y + (1 - info.norm(twin.value)) * (H - PAD_Y * 2)
    : 0;
  const first = info.current[0];
  const lastPoint = info.current.at(-1);
  const formatted = money.format(value);

  return (
    <div
      className={cn(
        "w-full max-w-md select-none rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-900">
          {periods.map((days) => (
            <button
              aria-pressed={days === period}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium tabular-nums outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                days === period
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
              key={days}
              onClick={() => choose(days)}
              type="button"
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 font-semibold text-4xl tracking-tight">
        <span className="sr-only">{formatted}</span>
        <RollingNumber value={formatted} />
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-sm tabular-nums">
        <span
          className={cn(
            "font-medium",
            up
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          )}
        >
          {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
        </span>
        <span aria-live="polite" className="text-zinc-500 dark:text-zinc-400">
          {point
            ? `${formatDay(point.date)} vs ${formatShort(twin?.date ?? point.date)}`
            : `vs previous ${period} days`}
        </span>
      </div>

      <div
        aria-label={`${label} over the last ${period} days. Use the arrow keys to read each day.`}
        aria-valuemax={info.current.length}
        aria-valuemin={1}
        aria-valuenow={scrubbing ? scrub + 1 : info.current.length}
        aria-valuetext={
          point
            ? `${formatDay(point.date)}: ${money.format(point.value)}`
            : `${money.format(info.total)} in total`
        }
        className="relative mt-5 h-32 cursor-crosshair touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
        onBlur={() => setScrub(null)}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={release}
        onPointerCancel={release}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setScrub(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        ref={chartRef}
        role="slider"
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect height={H + 20} width={(x / 100) * W} x={0} y={-10} />
            </clipPath>
          </defs>
          <line
            className="stroke-zinc-200 dark:stroke-zinc-800"
            vectorEffect="non-scaling-stroke"
            x1={0}
            x2={W}
            y1={H - 0.5}
            y2={H - 0.5}
          />
          <path
            className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
            d={info.paths.previous}
            ref={previousRef}
            strokeDasharray="3 4"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          {/* After the scrubbed day the line fades back. */}
          <path
            className="fill-none stroke-zinc-900/25 dark:stroke-zinc-100/25"
            d={info.paths.current}
            ref={currentDimRef}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="fill-none stroke-zinc-900 dark:stroke-zinc-100"
            clipPath={`url(#${clipId})`}
            d={info.paths.current}
            ref={currentRef}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {point && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800"
              style={{ left: `${x}%` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950"
              style={{ left: `${x}%`, top: `${(yPrev / H) * 100}%` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-4 ring-white dark:bg-zinc-100 dark:ring-zinc-950"
              style={{ left: `${x}%`, top: `${(y / H) * 100}%` }}
            />
          </>
        )}
      </div>

      <div className="mt-2 flex justify-between text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
        <span>{first ? formatShort(first.date) : ""}</span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-3 border-zinc-300 border-t border-dashed dark:border-zinc-700" />
          Previous period
        </span>
        <span>{lastPoint ? formatShort(lastPoint.date) : ""}</span>
      </div>
    </div>
  );
}
