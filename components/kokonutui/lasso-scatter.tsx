"use client";

/**
 * @author: @dorianbaffier
 * @description: Lasso Scatter
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const H = 260;
// Room for the axis labels, inside the plot box.
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };
// A new lasso point every few pixels keeps the path light.
const STEP_PX = 3;
const DIGIT = /\d/;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export type AccountPlan = "starter" | "team" | "enterprise";

export interface ScatterAccount {
  id: string;
  name: string;
  plan: AccountPlan;
  /** Monthly recurring revenue. */
  mrr: number;
  /** Share of seats active this week, 0 to 1. */
  usage: number;
}

export interface LassoScatterProps {
  title?: string;
  subtitle?: string;
  accounts?: ScatterAccount[];
  currency?: string;
  className?: string;
}

const PLANS: Record<AccountPlan, { label: string; fill: string; dot: string }> =
  {
    starter: {
      label: "Starter",
      fill: "fill-zinc-400 dark:fill-zinc-500",
      dot: "bg-zinc-400 dark:bg-zinc-500",
    },
    team: {
      label: "Team",
      fill: "fill-sky-500 dark:fill-sky-400",
      dot: "bg-sky-500 dark:bg-sky-400",
    },
    enterprise: {
      label: "Enterprise",
      fill: "fill-orange-500 dark:fill-orange-400",
      dot: "bg-orange-500 dark:bg-orange-400",
    },
  };

// Corners worth a look: paying well but barely used, and the opposite.
const PRESETS = [
  {
    name: "At risk",
    from: 0,
    to: 0.35,
    minMrr: 1000,
    hint: "Under 35% active, $1k+ a month",
  },
  {
    name: "Champions",
    from: 0.7,
    to: 1,
    minMrr: 1000,
    hint: "70%+ active, $1k+ a month",
  },
];

const NICE = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000,
];

const PLAN_ORDER: AccountPlan[] = ["enterprise", "team", "starter"];

const FIRST = [
  "North",
  "Bright",
  "Copper",
  "Tide",
  "Stone",
  "Fern",
  "Kestrel",
  "Harbor",
  "Silver",
  "Juniper",
  "Cobalt",
  "Willow",
];
const LAST = [
  "works",
  "line",
  "labs",
  "field",
  "wave",
  "craft",
  "stack",
  "point",
  "forge",
  "haven",
];

// Seeded, so server and browser plot the same accounts.
function demoAccounts(): ScatterAccount[] {
  let seed = 19;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  const out: ScatterAccount[] = [];
  for (let i = 0; i < 110; i++) {
    const roll = random();
    let plan: AccountPlan = "starter";
    if (roll > 0.82) {
      plan = "enterprise";
    } else if (roll > 0.45) {
      plan = "team";
    }
    const [lo, hi] = {
      starter: [40, 420],
      team: [380, 1600],
      enterprise: [1500, 5200],
    }[plan];
    // Usage leans high, with a tail of quiet accounts.
    const usage = Math.min(
      0.97,
      Math.max(0.04, 1 - (random() * random() * 1.25 + random() * 0.15))
    );
    out.push({
      id: `a${i}`,
      name: `${FIRST[i % FIRST.length]}${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`,
      plan,
      mrr: Math.round((lo + (hi - lo) * random() ** 1.6) / 10) * 10,
      usage: Math.round(usage * 100) / 100,
    });
  }
  return out;
}

const DEFAULT_ACCOUNTS = demoAccounts();

type Point = [number, number];

/** Ray casting, in the plot's 0 to 1 space. */
function inside(point: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) {
      hit = !hit;
    }
  }
  return hit;
}

function RollingNumber({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // Keyed from the right, so the units stay put as the length changes.
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          return (
            <span
              className="inline-block h-[1em] overflow-hidden leading-none"
              key={`s${key}`}
            >
              {char}
            </span>
          );
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

const anchorOf = (t: number) => {
  if (t === 0) {
    return "start";
  }
  return t === 1 ? "end" : "middle";
};

// Only read once the user is drawing, so it never runs on the server.
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Mode = "replace" | "add" | "remove";

const modeOf = (event: { shiftKey: boolean; altKey: boolean }): Mode => {
  if (event.altKey) {
    return "remove";
  }
  return event.shiftKey ? "add" : "replace";
};

export default function LassoScatter({
  title = "Accounts by usage and revenue",
  subtitle = "Each dot is an account. Draw around a group to read it.",
  accounts = DEFAULT_ACCOUNTS,
  currency = "USD",
  className,
}: LassoScatterProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // The lasso being drawn, and the last one, in 0 to 1 plot space.
  const [path, setPath] = useState<Point[] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The loop being drawn lives in the ref; pointer events can outrun renders.
  const draw = useRef<{
    mode: Mode;
    base: Set<string>;
    points: Point[];
  } | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency]
  );

  // Revenue spans two orders of magnitude, so the axis is logarithmic.
  const scale = useMemo(() => {
    const values = accounts.map((a) => a.mrr);
    const top = Math.max(1, ...values);
    const bottom = Math.max(1, Math.min(...values));
    const hi = NICE.find((n) => n >= top) ?? top;
    const lo = [...NICE].reverse().find((n) => n <= bottom) ?? bottom;
    return {
      lo,
      hi,
      ticks: NICE.filter((n) => n >= lo && n <= hi),
      y: (mrr: number) =>
        1 -
        (Math.log(Math.max(lo, mrr)) - Math.log(lo)) /
          (Math.log(hi) - Math.log(lo)),
    };
  }, [accounts]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  // Positions in the 0 to 1 plot space, then in pixels.
  const norm = (a: ScatterAccount): Point => [a.usage, scale.y(a.mrr)];
  const px = ([x, y]: Point): Point => [
    PAD.left + x * plotW,
    PAD.top + y * plotH,
  ];

  const pick = (polygon: Point[], mode: Mode, base: Set<string>) => {
    const next = mode === "replace" ? new Set<string>() : new Set(base);
    for (const a of accounts) {
      if (inside(norm(a), polygon)) {
        if (mode === "remove") {
          next.delete(a.id);
        } else {
          next.add(a.id);
        }
      }
    }
    return next;
  };

  const toPlot = (event: PointerEvent<HTMLDivElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - box.left - PAD.left) / plotW,
      (event.clientY - box.top - PAD.top) / plotH,
    ];
  };

  const nearest = (p: Point) => {
    let best: ScatterAccount | null = null;
    let bestD = 8;
    for (const a of accounts) {
      const [ax, ay] = px(norm(a));
      const [bx, by] = px(p);
      const d = Math.hypot(ax - bx, ay - by);
      if (d < bestD) {
        best = a;
        bestD = d;
      }
    }
    return best;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = toPlot(event);
    draw.current = { mode: modeOf(event), base: selected, points: [start] };
    setPath([start]);
    setPreset(null);
    setDrawing(true);
    setHovered(null);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = toPlot(event);
    const d = draw.current;
    if (!d) {
      setHovered(nearest(p)?.id ?? null);
      return;
    }
    const last = d.points.at(-1);
    if (
      last &&
      Math.hypot((p[0] - last[0]) * plotW, (p[1] - last[1]) * plotH) < STEP_PX
    ) {
      return;
    }
    d.points.push(p);
    const next = d.points.slice();
    setPath(next);
    // The selection follows the lasso while it is drawn.
    if (next.length > 2) {
      setSelected(pick(next, d.mode, d.base));
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = draw.current;
    draw.current = null;
    setDrawing(false);
    if (!d) {
      return;
    }
    // A click, not a loop: toggle the dot under it, or clear.
    if (d.points.length < 3) {
      const hit = nearest(toPlot(event));
      const next = d.mode === "replace" ? new Set<string>() : new Set(d.base);
      if (hit) {
        if (d.base.has(hit.id) && d.mode !== "add") {
          next.delete(hit.id);
        } else {
          next.add(hit.id);
        }
      }
      setSelected(next);
      setPath(null);
      return;
    }
    setPath(d.points.slice());
    setSelected(pick(d.points, d.mode, d.base));
  };

  /** Presets draw their own box, so they read like a lasso. */
  const choosePreset = (
    name: string,
    x0: number,
    x1: number,
    minMrr: number
  ) => {
    const y0 = 0;
    const y1 = scale.y(minMrr);
    const box: Point[] = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
    setPath(box);
    setPreset(name);
    setSelected(pick(box, "replace", new Set()));
  };

  const clear = () => {
    setSelected(new Set());
    setPath(null);
    setPreset(null);
  };

  const chosen = accounts.filter((a) => selected.has(a.id));
  const group = chosen.length ? chosen : accounts;
  const totalMrr = group.reduce((s, a) => s + a.mrr, 0);
  const avgUsage = group.length
    ? group.reduce((s, a) => s + a.usage, 0) / group.length
    : 0;
  const top = [...chosen].sort((a, b) => b.mrr - a.mrr).slice(0, 4);
  const mix = PLAN_ORDER.map((plan) => ({
    plan,
    mrr: group.filter((a) => a.plan === plan).reduce((s, a) => s + a.mrr, 0),
  }));
  const hoveredAccount = hovered
    ? accounts.find((a) => a.id === hovered)
    : undefined;

  const lasso =
    path && width
      ? `${path.map((p, i) => `${i ? "L" : "M"}${px(p)[0].toFixed(1)} ${px(p)[1].toFixed(1)}`).join(" ")}${drawing ? "" : " Z"}`
      : "";

  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const chip =
    "rounded-full px-2.5 py-1 font-medium text-xs outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400";

  return (
    <div
      className={cn(
        "w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              aria-pressed={preset === p.name}
              className={cn(
                chip,
                preset === p.name
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
              key={p.name}
              onClick={() => choosePreset(p.name, p.from, p.to, p.minMrr)}
              title={p.hint}
              type="button"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div
        aria-label="Scatter plot of accounts, usage across, revenue up. Drag to draw a lasso; Shift adds, Alt removes."
        className="relative mt-4 cursor-crosshair touch-none select-none"
        onLostPointerCapture={() => {
          draw.current = null;
          setDrawing(false);
        }}
        onPointerDown={onPointerDown}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={boxRef}
        role="img"
        style={{ height: H }}
      >
        {width > 0 && (
          <svg
            aria-hidden="true"
            className="absolute inset-0 overflow-visible"
            height={H}
            width={width}
          >
            {scale.ticks.map((t) => {
              const y = PAD.top + scale.y(t) * plotH;
              return (
                <g key={t}>
                  <line
                    className="stroke-zinc-100 dark:stroke-zinc-900"
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className="fill-zinc-400 text-[10px] tabular-nums dark:fill-zinc-500"
                    dominantBaseline="middle"
                    textAnchor="end"
                    x={PAD.left - 8}
                    y={y}
                  >
                    {t >= 1000 ? `$${t / 1000}k` : `$${t}`}
                  </text>
                </g>
              );
            })}
            {xTicks.map((t) => (
              <text
                className="fill-zinc-400 text-[10px] tabular-nums dark:fill-zinc-500"
                key={t}
                textAnchor={anchorOf(t)}
                x={PAD.left + t * plotW}
                y={H - 6}
              >
                {Math.round(t * 100)}%
              </text>
            ))}

            {lasso && (
              <path
                className="fill-zinc-900/[0.04] stroke-zinc-900 dark:fill-zinc-100/[0.06] dark:stroke-zinc-100"
                d={lasso}
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeWidth={1.25}
              >
                {/* Marching ants while the loop is open. */}
                {drawing && !reducedMotion() && (
                  <animate
                    attributeName="stroke-dashoffset"
                    dur="0.6s"
                    from="0"
                    repeatCount="indefinite"
                    to="-7"
                  />
                )}
              </path>
            )}

            {accounts.map((a) => {
              const [x, y] = px(norm(a));
              const isOn = selected.has(a.id);
              const dim = selected.size > 0 && !isOn;
              return (
                <circle
                  className={cn(
                    "origin-center stroke-white transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-box:fill-box] motion-reduce:transition-none dark:stroke-zinc-950",
                    PLANS[a.plan].fill
                  )}
                  cx={x}
                  cy={y}
                  key={a.id}
                  r={4}
                  strokeWidth={1.5}
                  style={{
                    opacity: dim ? 0.2 : 1,
                    scale: isOn || hovered === a.id ? 1.3 : 1,
                  }}
                />
              );
            })}
          </svg>
        )}

        {/* A small card for the dot under the pointer. */}
        {hoveredAccount && !drawing && (
          <div
            className="pointer-events-none absolute z-10 w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900"
            style={{
              left: Math.min(px(norm(hoveredAccount))[0] + 10, width - 184),
              top: Math.max(0, px(norm(hoveredAccount))[1] - 64),
            }}
          >
            <p className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  "size-2 rounded-full",
                  PLANS[hoveredAccount.plan].dot
                )}
              />
              {hoveredAccount.name}
            </p>
            <p className="mt-1 text-zinc-500 tabular-nums dark:text-zinc-400">
              {money.format(hoveredAccount.mrr)}/mo ·{" "}
              {Math.round(hoveredAccount.usage * 100)}% active
            </p>
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Seats active this week →</span>
        <span className="flex items-center gap-3">
          {PLAN_ORDER.map((plan) => (
            <span className="flex items-center gap-1.5" key={plan}>
              <span className={cn("size-2 rounded-full", PLANS[plan].dot)} />
              {PLANS[plan].label}
            </span>
          ))}
        </span>
      </div>

      <div className="mt-4 border-zinc-100 border-t pt-4 dark:border-zinc-900">
        <div className="flex items-baseline justify-between gap-3">
          <p aria-live="polite" className="text-sm">
            <span className="font-semibold text-2xl tracking-tight">
              <span className="sr-only">{group.length}</span>
              <RollingNumber value={String(group.length)} />
            </span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              {chosen.length ? "accounts selected" : "accounts"}
            </span>
          </p>
          {chosen.length > 0 && (
            <button
              className={cn(
                chip,
                "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
              onClick={clear}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">MRR</dt>
            <dd className="mt-1 font-medium text-base tabular-nums">
              <span className="sr-only">{money.format(totalMrr)}</span>
              <RollingNumber value={money.format(totalMrr)} />
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">
              Seats active, average
            </dt>
            <dd className="mt-1 font-medium text-base tabular-nums">
              <span className="sr-only">{Math.round(avgUsage * 100)}%</span>
              <RollingNumber value={`${Math.round(avgUsage * 100)}%`} />
            </dd>
          </div>
        </dl>
        {/* Revenue by plan, as one bar. */}
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {mix.map((m) => (
            <span
              className={cn(
                "h-full transition-[flex-grow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                PLANS[m.plan].dot
              )}
              key={m.plan}
              style={{ flexGrow: m.mrr, flexBasis: 0 }}
            />
          ))}
        </div>
        {top.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-100 text-xs dark:divide-zinc-900">
            {top.map((a) => (
              <li className="flex items-center gap-2 py-1.5" key={a.id}>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    PLANS[a.plan].dot
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {a.name}
                </span>
                <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                  {Math.round(a.usage * 100)}% active
                </span>
                <span className="w-20 text-right tabular-nums">
                  {money.format(a.mrr)}
                </span>
              </li>
            ))}
            {chosen.length > top.length && (
              <li className="py-1.5 text-zinc-400 dark:text-zinc-500">
                and {chosen.length - top.length} more
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
            Draw around dots to select them. Shift adds to the selection, Alt
            takes away.
          </p>
        )}
      </div>
    </div>
  );
}
