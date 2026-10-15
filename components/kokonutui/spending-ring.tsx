"use client";

/**
 * @author: @dorianbaffier
 * @description: Spending Ring
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
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const SIZE = 240;
const C = SIZE / 2;
const R = 90;
const STROKE = 22;
// Degrees left empty between categories.
const GAP = 2.4;
// Spring for the ring's angle: rate in rad/s and damping ratio. A touch under
// critical so a flick settles onto its category with a small give.
const RATE = 11;
const DAMPING = 0.78;
// How far ahead a flick is projected when choosing where it lands, in seconds.
const PROJECT = 0.2;
// Movement under this many pixels is a tap, not a spin.
const TAP_SLOP = 5;

export interface SpendingCategory {
  name: string;
  amount: number;
  /** Change from last month, in percent. */
  change?: number;
  /** Tailwind classes for the segment stroke and the legend dot. */
  stroke: string;
  dot: string;
}

export interface SpendingRingProps {
  title?: string;
  categories?: SpendingCategory[];
  currency?: string;
  className?: string;
}

const DEFAULT_CATEGORIES: SpendingCategory[] = [
  {
    name: "Housing",
    amount: 1250,
    change: 0,
    stroke: "stroke-sky-500 dark:stroke-sky-400",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  {
    name: "Groceries",
    amount: 486.2,
    change: -6.1,
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    name: "Shopping",
    amount: 398.1,
    change: 22.4,
    stroke: "stroke-rose-500 dark:stroke-rose-400",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  {
    name: "Dining out",
    amount: 312.75,
    change: 12.8,
    stroke: "stroke-amber-400 dark:stroke-amber-300",
    dot: "bg-amber-400 dark:bg-amber-300",
  },
  {
    name: "Transport",
    amount: 214.4,
    change: -3.5,
    stroke: "stroke-violet-500 dark:stroke-violet-400",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
  {
    name: "Subscriptions",
    amount: 86.97,
    change: 0,
    stroke: "stroke-zinc-400 dark:stroke-zinc-500",
    dot: "bg-zinc-400 dark:bg-zinc-500",
  },
];

/** Wraps an angle into -180..180. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** A point on the ring, with 0° at the top and angles running clockwise. */
function polar(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)] as const;
}

function arc(from: number, to: number) {
  const [x0, y0] = polar(from);
  const [x1, y1] = polar(to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** The category whose slice covers an angle on the ring. */
function sliceAt(spans: { from: number; to: number }[], deg: number) {
  const a = ((deg % 360) + 360) % 360;
  const index = spans.findIndex((s) => a >= s.from && a < s.to);
  return index === -1 ? 0 : index;
}

/** One step of a damped spring, in small slices for stability. */
function springStep(
  state: { a: number; v: number },
  target: number,
  dt: number
) {
  const slices = Math.ceil(dt / (1 / 240));
  const h = dt / slices;
  for (let i = 0; i < slices; i++) {
    const accel =
      -RATE * RATE * (state.a - target) - 2 * DAMPING * RATE * state.v;
    state.v += accel * h;
    state.a += state.v * h;
  }
  return Math.abs(state.a - target) < 0.05 && Math.abs(state.v) < 2;
}

export default function SpendingRing({
  title = "October spending",
  categories = DEFAULT_CATEGORIES,
  currency = "USD",
  className,
}: SpendingRingProps) {
  const [selected, setSelected] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const ringRef = useRef<SVGGElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(0);

  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const spans = useMemo(() => {
    let at = 0;
    return categories.map((c) => {
      const sweep = total ? (c.amount / total) * 360 : 360 / categories.length;
      const span = { from: at, to: at + sweep, mid: at + sweep / 2 };
      at += sweep;
      return span;
    });
  }, [categories, total]);

  // The ring turns so the selected slice sits under the marker at the top.
  const sim = useRef({
    a: -(spans[0]?.mid ?? 0),
    v: 0,
    target: -(spans[0]?.mid ?? 0),
    raf: 0,
    last: 0,
    // While a flick coasts, the readout follows whatever passes the marker.
    coast: false,
    drag: null as null | {
      id: number;
      angle: number;
      time: number;
      moved: number;
      x: number;
      y: number;
    },
  });

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }),
    [currency]
  );

  const paint = useCallback(() => {
    ringRef.current?.setAttribute(
      "transform",
      `rotate(${sim.current.a.toFixed(3)} ${C} ${C})`
    );
  }, []);

  /** Show whichever slice is under the marker right now. */
  const track = useCallback(() => {
    const index = sliceAt(spans, -sim.current.a);
    if (index !== selectedRef.current) {
      selectedRef.current = index;
      setSelected(index);
    }
  }, [spans]);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      if (s.drag) {
        return;
      }
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const state = { a: s.a, v: s.v };
      const settled = springStep(state, s.target, dt);
      s.a = settled ? s.target : state.a;
      s.v = settled ? 0 : state.v;
      paint();
      if (s.coast) {
        track();
      }
      if (settled) {
        s.last = 0;
        s.coast = false;
        setSpinning(false);
      } else {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [paint, track]
  );

  /**
   * Turn the ring to a slice, the short way round from where it would come to
   * rest on its own (a flick keeps going the way it was thrown).
   */
  const turnTo = useCallback(
    (index: number, rest = sim.current.a, coast = false) => {
      const s = sim.current;
      const goal = -(spans[index]?.mid ?? 0);
      s.target = rest + wrap(goal - rest);
      s.coast = coast;
      if (!coast) {
        selectedRef.current = index;
        setSelected(index);
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        s.a = s.target;
        s.v = 0;
        s.coast = false;
        paint();
        track();
        return;
      }
      setSpinning(true);
      if (!s.raf) {
        s.last = 0;
        s.raf = requestAnimationFrame(tick);
      }
    },
    [paint, spans, tick, track]
  );

  // New data keeps the same slice under the marker.
  useEffect(() => {
    const s = sim.current;
    const index = Math.min(selectedRef.current, spans.length - 1);
    s.a = -(spans[index]?.mid ?? 0);
    s.target = s.a;
    s.v = 0;
    selectedRef.current = index;
    setSelected(index);
    paint();
  }, [spans, paint]);

  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  const pointerAngle = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return (Math.atan2(x, -y) * 180) / Math.PI;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.drag || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.v = 0;
    s.drag = {
      id: event.pointerId,
      angle: pointerAngle(event),
      time: event.timeStamp,
      moved: 0,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    drag.moved = Math.max(
      drag.moved,
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
    );
    if (drag.moved < TAP_SLOP) {
      return;
    }
    const angle = pointerAngle(event);
    const delta = wrap(angle - drag.angle);
    const dt = Math.max((event.timeStamp - drag.time) / 1000, 1 / 240);
    s.a += delta;
    // Smoothed angular speed, for the flick on release.
    s.v = s.v * 0.6 + (delta / dt) * 0.4;
    drag.angle = angle;
    drag.time = event.timeStamp;
    setSpinning(true);
    paint();
    track();
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    s.drag = null;
    if (drag.moved < TAP_SLOP) {
      // A tap on the ring picks the slice under the finger; the middle is
      // only a readout.
      const rect = event.currentTarget.getBoundingClientRect();
      const r = Math.hypot(
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2
      );
      if (r > ((R - STROKE) / SIZE) * rect.width) {
        turnTo(sliceAt(spans, pointerAngle(event) - s.a));
      }
      return;
    }
    // A stale drag (held still before letting go) has no flick left in it.
    if (event.timeStamp - drag.time > 80) {
      s.v = 0;
    }
    s.v = Math.max(-1440, Math.min(1440, s.v));
    const rest = s.a + s.v * PROJECT;
    turnTo(sliceAt(spans, -rest), rest, true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in step) {
      next =
        (selected + step[event.key] + categories.length) % categories.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = categories.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      turnTo(next);
    }
  };

  const current = categories[selected];
  const share = total && current ? (current.amount / total) * 100 : 0;
  const change = current?.change ?? 0;

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="font-medium text-sm tabular-nums">
          {money.format(total)}
        </p>
      </div>

      <div
        aria-label="Spending by category. Use the arrow keys to turn the ring."
        aria-valuemax={categories.length}
        aria-valuemin={1}
        aria-valuenow={selected + 1}
        aria-valuetext={
          current ? `${current.name}, ${money.format(current.amount)}` : ""
        }
        className={cn(
          "relative mx-auto mt-3 aspect-square w-full max-w-[240px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950",
          spinning ? "cursor-grabbing" : "cursor-grab"
        )}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={release}
        onPointerCancel={release}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        ref={surfaceRef}
        role="slider"
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <g ref={ringRef} transform={`rotate(${sim.current.a} ${C} ${C})`}>
            {spans.map((span, i) => {
              const category = categories[i];
              const on = i === selected;
              return (
                <path
                  className={cn(
                    "transition-[stroke-width,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    category.stroke,
                    !on && "opacity-40 dark:opacity-50"
                  )}
                  d={arc(span.from + GAP / 2, span.to - GAP / 2)}
                  fill="none"
                  key={category.name}
                  strokeWidth={on ? STROKE + 8 : STROKE}
                />
              );
            })}
          </g>
          {/* The marker the ring turns slices to. */}
          <path
            className="fill-zinc-900 dark:fill-zinc-100"
            d={`M${C - 5} 2 L${C + 5} 2 L${C} 8 Z`}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div
            className="starting:translate-y-1 starting:opacity-0 transition-[opacity,translate] duration-200 ease-out"
            key={current?.name}
          >
            <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className={cn("size-1.5 rounded-full", current?.dot)} />
              {current?.name}
            </p>
            <p className="mt-0.5 font-semibold text-2xl tabular-nums tracking-tight">
              {current ? money.format(current.amount) : ""}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              {share.toFixed(0)}% of total
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs tabular-nums",
                change > 0 && "text-rose-600 dark:text-rose-400",
                change < 0 && "text-emerald-600 dark:text-emerald-400",
                change === 0 && "text-zinc-400 dark:text-zinc-500"
              )}
            >
              {change === 0
                ? "Same as last month"
                : `${change > 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs last month`}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-1">
        {categories.map((category, i) => (
          <li key={category.name}>
            <button
              aria-pressed={i === selected}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                i === selected
                  ? "bg-zinc-100 dark:bg-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
              )}
              onClick={() => turnTo(i)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", category.dot)}
              />
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <span className="tabular-nums">
                {money.format(Math.round(category.amount)).replace(".00", "")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
