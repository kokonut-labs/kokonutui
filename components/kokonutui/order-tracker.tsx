"use client";

/**
 * @author: @dorianbaffier
 * @description: Order Tracker
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Copy, Package } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// The map is drawn in this box and scaled to the card's width.
const W = 400;
const H = 150;
// Samples per leg when measuring the route.
const STEPS = 48;
// Spring rates, in radians per second: a long first drive in, quick hops after.
const INTRO_RATE = 4.2;
const HOP_RATE = 13;

export interface TrackingStep {
  label: string;
  place: string;
  /** When it was scanned, or when it is expected. */
  time: string;
  note?: string;
  /** Where it sits on the map, in a 400 × 150 box. */
  point: [number, number];
  /** Put the place name above the stop instead of below. */
  labelAbove?: boolean;
}

export interface OrderTrackerProps {
  steps?: TrackingStep[];
  /** Index of the latest scan. */
  current?: number;
  /** How far along the next leg the parcel is, 0 to 1. */
  progress?: number;
  eta?: string;
  etaDetail?: string;
  order?: string;
  trackingNumber?: string;
  className?: string;
}

const DEFAULT_STEPS: TrackingStep[] = [
  {
    label: "Packed",
    place: "Reno, NV",
    time: "Mon, Oct 12 · 10:04 am",
    note: "Packed at the fulfilment center, 1.2 kg.",
    point: [28, 104],
  },
  {
    label: "Sorted",
    place: "Salt Lake City, UT",
    time: "Tue, Oct 13 · 6:51 am",
    note: "Scanned at the sort facility and loaded on time.",
    point: [118, 48],
    labelAbove: true,
  },
  {
    label: "At regional hub",
    place: "Denver, CO",
    time: "Wed, Oct 14 · 2:17 am",
    note: "Left the hub for the local depot.",
    point: [214, 100],
  },
  {
    label: "Out for delivery",
    place: "Boulder, CO",
    time: "Expected Thu, 7 am",
    point: [300, 46],
    labelAbove: true,
  },
  {
    label: "Delivered",
    place: "Your door",
    time: "Expected Thu, by 8 pm",
    point: [372, 94],
  },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

interface Route {
  /** Smooth path through every stop. */
  d: string;
  /** Points along the route and the distance to each. */
  xs: Float64Array;
  ys: Float64Array;
  lens: Float64Array;
  /** Distance to each stop. */
  stops: number[];
}

/** A Catmull-Rom curve through the stops, one cubic per leg, measured. */
function buildRoute(points: [number, number][]): Route {
  const legs = Math.max(points.length - 1, 0);
  const count = legs * STEPS + 1;
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  const lens = new Float64Array(count);
  const stops = [0];
  const at = (i: number) => points[clamp(i, 0, points.length - 1)];
  let d = points.length ? `M${points[0][0]} ${points[0][1]}` : "";
  xs[0] = points[0]?.[0] ?? 0;
  ys[0] = points[0]?.[1] ?? 0;
  for (let leg = 0; leg < legs; leg++) {
    const [p0, p1, p2, p3] = [at(leg - 1), at(leg), at(leg + 1), at(leg + 2)];
    const c1: [number, number] = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
    ];
    const c2: [number, number] = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
    ];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const u = 1 - t;
      const i = leg * STEPS + s;
      xs[i] =
        u * u * u * p1[0] +
        3 * u * u * t * c1[0] +
        3 * u * t * t * c2[0] +
        t * t * t * p2[0];
      ys[i] =
        u * u * u * p1[1] +
        3 * u * u * t * c1[1] +
        3 * u * t * t * c2[1] +
        t * t * t * p2[1];
      lens[i] = lens[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    stops.push(lens[(leg + 1) * STEPS]);
  }
  return { d, xs, ys, lens, stops };
}

/** The point at a distance along the route, and the sample just before it. */
function pointAt(route: Route, s: number) {
  const { xs, ys, lens } = route;
  const last = lens.length - 1;
  const target = clamp(s, 0, lens[last]);
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (lens[mid] < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const span = lens[hi] - lens[lo] || 1;
  const f = (target - lens[lo]) / span;
  return {
    x: xs[lo] + (xs[hi] - xs[lo]) * f,
    y: ys[lo] + (ys[hi] - ys[lo]) * f,
    index: lo,
  };
}

/** The travelled part of the route, as a polyline up to a distance. */
function travelledPath(route: Route, s: number) {
  const end = pointAt(route, s);
  let d = `M${route.xs[0].toFixed(2)} ${route.ys[0].toFixed(2)}`;
  for (let i = 1; i <= end.index; i++) {
    d += `L${route.xs[i].toFixed(2)} ${route.ys[i].toFixed(2)}`;
  }
  return `${d}L${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** One step of a critically damped spring, in small slices for stability. */
function springStep(
  state: { s: number; v: number },
  target: number,
  rate: number,
  dt: number
) {
  const slices = Math.ceil(dt / (1 / 240));
  const h = dt / slices;
  for (let i = 0; i < slices; i++) {
    const accel = -rate * rate * (state.s - target) - 2 * rate * state.v;
    state.v += accel * h;
    state.s += state.v * h;
  }
  return Math.abs(state.s - target) < 0.05 && Math.abs(state.v) < 0.5;
}

export default function OrderTracker({
  steps = DEFAULT_STEPS,
  current = 2,
  progress = 0.42,
  eta = "Arriving Thursday",
  etaDetail = "By 8 pm · Ground shipping",
  order = "Order #KK-1042",
  trackingNumber = "KK 4417 2081 93",
  className,
}: OrderTrackerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const travelledRef = useRef<SVGPathElement>(null);
  const parcelRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef(0);
  const patternId = useId();

  const pointsKey = steps.map((step) => step.point.join(",")).join(" ");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route only changes when the stops move
  const route = useMemo(
    () => buildRoute(steps.map((s) => s.point)),
    [pointsKey]
  );
  const last = steps.length - 1;
  const latest = clamp(current, 0, last);
  const total = route.lens.at(-1) ?? 0;
  const liveAt =
    latest >= last
      ? total
      : route.stops[latest] +
        (route.stops[latest + 1] - route.stops[latest]) * clamp(progress, 0, 1);

  const sim = useRef({
    s: liveAt,
    v: 0,
    target: liveAt,
    rate: HOP_RATE,
    line: liveAt,
    raf: 0,
    last: 0,
  });

  const paint = useCallback(() => {
    const s = sim.current;
    const p = pointAt(route, s.s);
    const parcel = parcelRef.current;
    if (parcel) {
      parcel.style.left = `${(p.x / W) * 100}%`;
      parcel.style.top = `${(p.y / H) * 100}%`;
    }
    travelledRef.current?.setAttribute("d", travelledPath(route, s.line));
    // A stop fills in once the line has reached it.
    const stops = cardRef.current?.querySelectorAll<HTMLElement>("[data-stop]");
    for (const stop of stops ?? []) {
      const reached = s.line >= route.stops[Number(stop.dataset.stop)] - 0.5;
      stop.dataset.reached = String(reached);
    }
  }, [route]);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const state = { s: s.s, v: s.v };
      const settled = springStep(state, s.target, s.rate, dt);
      s.s = settled ? s.target : state.s;
      s.v = settled ? 0 : state.v;
      // The solid line follows the parcel forward, never back.
      s.line = Math.max(s.line, Math.min(s.s, liveAt));
      paint();
      if (settled) {
        s.last = 0;
        s.rate = HOP_RATE;
      } else {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [liveAt, paint]
  );

  const driveTo = useCallback(
    (target: number) => {
      const s = sim.current;
      s.target = target;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        s.s = target;
        s.v = 0;
        s.line = Math.max(s.line, Math.min(target, liveAt));
        paint();
        return;
      }
      if (!s.raf) {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [liveAt, paint, tick]
  );

  // Drive in from the first stop the first time the card is on screen.
  // Later changes go through driveTo, so this runs on mount only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intro runs once
  useLayoutEffect(() => {
    const s = sim.current;
    const card = cardRef.current;
    if (
      !card ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      paint();
      return;
    }
    s.s = 0;
    s.v = 0;
    s.line = 0;
    paint();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          s.rate = INTRO_RATE;
          driveTo(liveAt);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  // New tracking data moves the parcel on from wherever it is.
  const shownLive = useRef(liveAt);
  useEffect(() => {
    if (shownLive.current === liveAt) {
      return;
    }
    shownLive.current = liveAt;
    sim.current.line = Math.min(sim.current.line, liveAt);
    setSelected(null);
    driveTo(liveAt);
  }, [liveAt, driveTo]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const select = (index: number | null) => {
    const next =
      index === null || index === selected || index >= latest ? null : index;
    setSelected(next);
    driveTo(next === null ? liveAt : route.stops[next]);
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(trackingNumber.replace(/\s/g, ""))
      .catch(() => {
        // Clipboard can be blocked; the number is on screen either way.
      });
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && selected !== null) {
      select(null);
    }
  };

  const shownStop = hovered ?? selected;
  const livePoint = pointAt(route, liveAt);
  const initial = pointAt(route, liveAt);

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={cardRef}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold text-xl tracking-tight">{eta}</p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {etaDetail}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{order}</p>
          <button
            aria-label={
              copied
                ? "Tracking number copied"
                : `Copy tracking number ${trackingNumber}`
            }
            className="mt-0.5 -ml-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-xs text-zinc-700 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 sm:mr-[-6px] sm:ml-0 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={copy}
            type="button"
          >
            {trackingNumber}
            <span className="relative size-3.5">
              <Copy
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 size-3.5 text-zinc-400 transition-[opacity,filter] duration-200 ease-out",
                  copied ? "opacity-0 blur-[2px]" : "opacity-100"
                )}
              />
              <Check
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 size-3.5 text-emerald-600 transition-[opacity,filter] duration-200 ease-out dark:text-emerald-400",
                  copied ? "opacity-100" : "opacity-0 blur-[2px]"
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* The route, drawn in a fixed box so stops and parcel share one scale. */}
      <div className="relative mt-4 aspect-[400/150] w-full overflow-hidden rounded-2xl bg-zinc-50 dark:bg-zinc-900">
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <pattern
              height="10"
              id={patternId}
              patternUnits="userSpaceOnUse"
              width="10"
            >
              <circle
                className="fill-zinc-200 dark:fill-zinc-800"
                cx="1"
                cy="1"
                r="0.8"
              />
            </pattern>
          </defs>
          <rect fill={`url(#${patternId})`} height={H} width={W} />
          <path
            className="stroke-zinc-300 dark:stroke-zinc-700"
            d={route.d}
            fill="none"
            strokeDasharray="3 4"
            strokeLinecap="round"
            strokeWidth={1.5}
          />
          <path
            className="stroke-zinc-900 dark:stroke-zinc-100"
            d={travelledPath(route, liveAt)}
            fill="none"
            ref={travelledRef}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
        </svg>

        {steps.map((step, i) => {
          const lit = i === shownStop;
          return (
            <div
              aria-hidden="true"
              className="absolute"
              key={step.place}
              style={{
                left: `${(step.point[0] / W) * 100}%`,
                top: `${(step.point[1] / H) * 100}%`,
              }}
            >
              <span
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-300 bg-zinc-50 transition-[box-shadow,background-color,border-color] duration-200 ease-out data-[reached=true]:border-zinc-900 data-[reached=true]:bg-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:data-[reached=true]:border-zinc-100 dark:data-[reached=true]:bg-zinc-100",
                  lit &&
                    "shadow-[0_0_0_4px] shadow-zinc-900/15 dark:shadow-zinc-100/20"
                )}
                data-reached={i <= latest}
                data-stop={i}
              />
              <span
                className={cn(
                  "absolute -translate-x-1/2 whitespace-nowrap text-[11px] transition-colors duration-200 ease-out",
                  step.labelAbove ? "bottom-2" : "top-2",
                  lit
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500",
                  i === 0 && "translate-x-[-20%]",
                  i === last && "translate-x-[-80%]"
                )}
              >
                {step.place.split(",")[0]}
              </span>
            </div>
          );
        })}

        {/* Where the parcel really is, kept while it shows an earlier scan. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-zinc-50 transition-opacity duration-200 ease-out dark:border-zinc-100 dark:bg-zinc-900",
            selected === null ? "opacity-0" : "opacity-100"
          )}
          style={{
            left: `${(livePoint.x / W) * 100}%`,
            top: `${(livePoint.y / H) * 100}%`,
          }}
        />

        <div
          aria-hidden="true"
          className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          ref={parcelRef}
          style={{
            left: `${(initial.x / W) * 100}%`,
            top: `${(initial.y / H) * 100}%`,
          }}
        >
          <Package className="size-3.5" strokeWidth={2} />
        </div>
      </div>

      <ol aria-label="Tracking history" className="mt-4">
        {steps.map((step, i) => {
          const done = i <= latest;
          const isLatest = i === latest;
          const open = i === selected;
          const rail = i < last;
          return (
            <li className="relative" key={step.place}>
              {rail && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[22px] bottom-[-10px] left-[15px] w-0 border-l",
                    i < latest
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 border-dashed dark:border-zinc-700"
                  )}
                />
              )}
              <button
                aria-current={isLatest ? "step" : undefined}
                aria-expanded={done && !isLatest ? open : undefined}
                className={cn(
                  "relative flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                  done && !isLatest
                    ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    : "cursor-default",
                  open && "bg-zinc-100 dark:bg-zinc-900"
                )}
                disabled={!done}
                onBlur={() => setHovered(null)}
                onClick={() => select(i)}
                onFocus={() => setHovered(i)}
                onKeyDown={handleKeyDown}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[5px] flex size-3 shrink-0 items-center justify-center rounded-full border-2",
                    done
                      ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
                      : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950",
                    isLatest &&
                      "bg-white ring-2 ring-zinc-900/10 dark:bg-zinc-950 dark:ring-zinc-100/15"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span
                      className={cn(
                        "font-medium",
                        !done && "text-zinc-400 dark:text-zinc-500"
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      {step.time}
                    </span>
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {step.place}
                    {isLatest && i < last && (
                      <> · On the way to {steps[i + 1].place.split(",")[0]}</>
                    )}
                  </span>
                  {/* An earlier scan opens its details while the parcel goes back to it. */}
                  <span
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                      open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <span className="overflow-hidden">
                      <span className="block pt-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {step.note ?? "Scanned here."}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
