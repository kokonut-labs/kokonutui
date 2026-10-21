"use client";

/**
 * @author: @dorianbaffier
 * @description: Cohort Table
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Row height and the gap between tiles, in pixels. Columns share the width.
const ROW = 32;
const GAP = 4;
// The chart reuses the rows' box: 100% at the top, 0% at the bottom.
const PAD_Y = 10;
const MORPH_MS = 520;
const STAGGER_MS = 22;
const EASE_MOVE = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const TICKS = [1, 0.75, 0.5, 0.25, 0];

export interface Cohort {
  /** Shown in the first column, e.g. "Mar". */
  label: string;
  /** People who signed up in this cohort. */
  users: number;
  /** Share still active each month after signup, from month 0. 0 to 1. */
  retention: number[];
}

export interface CohortTableProps {
  title?: string;
  subtitle?: string;
  cohorts?: Cohort[];
  /** Months after signup to show. */
  months?: number;
  defaultView?: "table" | "chart";
  className?: string;
}

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

// Seeded, so server and browser draw the same triangle. Cohorts after the
// July onboarding change hold on better.
function demoCohorts(): Cohort[] {
  let seed = 11;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  return MONTHS.map((label, i) => {
    const better = i >= 4 ? 0.1 + (i - 4) * 0.02 : 0;
    const floor = 0.15 + better + random() * 0.025;
    const decay = 0.66 - better * 2 + random() * 0.05;
    const retention: number[] = [];
    for (let m = 0; m < MONTHS.length - i; m++) {
      const v = m === 0 ? 1 : floor + (1 - floor) * Math.exp(-decay * m);
      retention.push(
        Math.round(v * (m === 0 ? 1 : 0.97 + random() * 0.04) * 1000) / 1000
      );
    }
    return {
      label,
      users: Math.round(980 + i * 70 + random() * 160),
      retention,
    };
  });
}

const DEFAULT_COHORTS = demoCohorts();

const percent = (v: number) => `${Math.round(v * 100)}%`;
const count = new Intl.NumberFormat("en-US");

interface Cell {
  /** -1 for the average row. */
  row: number;
  col: number;
}

/** Signup-weighted average for each month, over cohorts old enough. */
function averages(cohorts: Cohort[], months: number) {
  const out: number[] = [];
  for (let m = 0; m < months; m++) {
    let users = 0;
    let kept = 0;
    for (const c of cohorts) {
      const v = c.retention[m];
      if (v !== undefined) {
        users += c.users;
        kept += c.users * v;
      }
    }
    if (users > 0) {
      out.push(kept / users);
    }
  }
  return out;
}

/** Ink for a tile, from light to deep teal as more people stay. */
const tileStyle = (v: number) => {
  // Month 0 is always 100%, so it gets the full shade without being loud.
  const strength = v ** 1.4;
  return {
    "--a": (0.06 + strength * 0.86).toFixed(3),
  } as Record<string, string>;
};

const STEPS: Record<string, [number, number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
};

/** On the chart, the line nearest the pointer at that month. */
function nearestLine(
  cohorts: Cohort[],
  avg: number[],
  col: number,
  y: number,
  yOf: (v: number) => number
): Cell | null {
  let best: Cell | null = null;
  let bestD = 28;
  for (let r = -1; r < cohorts.length; r++) {
    const v = r < 0 ? avg[col] : cohorts[r].retention[col];
    const d = v === undefined ? bestD : Math.abs(yOf(v) - y);
    if (d < bestD) {
      bestD = d;
      best = { row: r, col };
    }
  }
  return best;
}

function readoutFor(
  cohorts: Cohort[],
  avg: number[],
  active: Cell | null,
  fallback: string
) {
  if (active && active.row < 0) {
    return `Month ${active.col}, all cohorts: ${percent(avg[active.col] ?? 0)} still active on average.`;
  }
  if (active) {
    const c = cohorts[active.row];
    const v = c.retention[active.col] ?? 0;
    return `${c.label} cohort, month ${active.col}: ${percent(v)}, ${count.format(Math.round(c.users * v))} of ${count.format(c.users)} still active.`;
  }
  // At rest: the month-1 average and the cohort that kept the most.
  if (avg.length < 2 || cohorts.length === 0) {
    return fallback;
  }
  let best = cohorts[0];
  for (const c of cohorts) {
    if ((c.retention[1] ?? 0) > (best.retention[1] ?? 0)) {
      best = c;
    }
  }
  return `Month 1 averages ${percent(avg[1])}; ${best.label} kept the most at ${percent(best.retention[1] ?? 0)}.`;
}

interface TileProps {
  value: number;
  label: string;
  isAvg: boolean;
  chart: boolean;
  /** This is the cell being read. */
  active: boolean;
  /** Something is being read, so dots stop waiting on the morph. */
  quiet: boolean;
  lit: boolean;
  tabbable: boolean;
  dy: number;
  delay: number;
  style: CSSProperties;
  ref: Ref<HTMLButtonElement>;
  onFocus: () => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const faceTone = (isAvg: boolean, v: number) => {
  if (isAvg) {
    return "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";
  }
  const ink = v > 0.55 ? "text-white" : "text-zinc-700";
  // The dark ramp starts near black, so only the deepest tiles take dark ink.
  const darkInk = v > 0.8 ? "dark:text-zinc-950" : "dark:text-zinc-100";
  return `bg-[rgb(13_148_136/var(--a))] dark:bg-[rgb(45_212_191/var(--a))] ${ink} ${darkInk}`;
};

const faceOpacity = (chart: boolean, lit: boolean) => {
  if (chart) {
    return 0;
  }
  return lit ? 1 : 0.35;
};

const dotOpacity = (chart: boolean, lit: boolean) => {
  if (!chart) {
    return 0;
  }
  return lit ? 1 : 0.25;
};

const dotScale = (chart: boolean, active: boolean) => {
  if (!chart) {
    return 0.4;
  }
  return active ? 1.4 : 1;
};

/**
 * One cell. The button rides to the cell's height on the chart; inside, the
 * tile shrinks away into the dot.
 */
function Tile({
  value,
  label,
  isAvg,
  chart,
  active,
  quiet,
  lit,
  tabbable,
  dy,
  delay,
  style,
  ref,
  onFocus,
  onSelect,
  onKeyDown,
}: TileProps) {
  return (
    <button
      aria-label={label}
      className="absolute flex items-center justify-center outline-none focus-visible:z-10 [&:focus-visible>span:first-child]:ring-2 [&:focus-visible>span:first-child]:ring-zinc-400"
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      ref={ref}
      style={{
        ...style,
        transform: `translateY(${dy}px)`,
        transition: `transform ${MORPH_MS}ms ${EASE_MOVE} ${delay}ms`,
      }}
      tabIndex={tabbable ? 0 : -1}
      type="button"
    >
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-md font-medium text-[10px] tabular-nums tracking-tight transition-[opacity,scale] motion-reduce:transition-none sm:text-[11px] sm:tracking-normal",
          faceTone(isAvg, value),
          active &&
            !chart &&
            "ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100"
        )}
        style={{
          ...(isAvg ? {} : tileStyle(value)),
          opacity: faceOpacity(chart, lit),
          scale: chart ? 0.25 : 1,
          transitionDuration: `${chart ? MORPH_MS * 0.7 : MORPH_MS * 0.5}ms`,
          transitionTimingFunction: EASE_OUT,
          transitionDelay: `${chart ? delay : delay + MORPH_MS * 0.4}ms`,
        }}
      >
        {percent(value)}
      </span>
      <span
        className={cn(
          "relative size-2 rounded-full ring-2 ring-white transition-[opacity,scale,background-color] motion-reduce:transition-none dark:ring-zinc-950",
          isAvg || active
            ? "bg-teal-600 dark:bg-teal-400"
            : "bg-zinc-400 dark:bg-zinc-500"
        )}
        style={{
          opacity: dotOpacity(chart, lit),
          scale: dotScale(chart, active),
          transitionDuration: `${MORPH_MS * 0.6}ms`,
          transitionTimingFunction: EASE_OUT,
          transitionDelay:
            chart && !quiet ? `${delay + MORPH_MS * 0.5}ms` : "0ms",
        }}
      />
    </button>
  );
}

function lineOpacity(
  row: number,
  rows: number,
  chart: boolean,
  active: Cell | null
) {
  if (!chart) {
    return 0;
  }
  if (active) {
    return active.row === row ? 1 : 0.25;
  }
  return row < 0 ? 1 : 0.35 + (0.65 * (row + 1)) / rows;
}

export default function CohortTable({
  title = "Retention by signup month",
  subtitle = "Active users, months after signup",
  cohorts = DEFAULT_COHORTS,
  months = 8,
  defaultView = "table",
  className,
}: CohortTableProps) {
  const [view, setView] = useState(defaultView);
  const [hover, setHover] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell>({ row: 0, col: 0 });
  const plotRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());

  const avg = useMemo(() => averages(cohorts, months), [cohorts, months]);
  const rows = cohorts.length;
  // The average row sits under a small gap; the chart spans all of it.
  const plotH = (rows + 1) * ROW + GAP * 2;
  const chart = view === "chart";
  const active = hover;

  const rowTop = (row: number) => (row < 0 ? rows * ROW + GAP * 2 : row * ROW);
  const yOf = (v: number) => PAD_Y + (1 - v) * (plotH - PAD_Y * 2);

  const cellFrom = (event: PointerEvent<HTMLDivElement>): Cell | null => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box) {
      return null;
    }
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const col = Math.min(
      months - 1,
      Math.max(0, Math.floor((x / box.width) * months))
    );
    if (chart) {
      return nearestLine(cohorts, avg, col, y, yOf);
    }
    if (y > rows * ROW + GAP) {
      return col < avg.length ? { row: -1, col } : null;
    }
    const row = Math.floor(y / ROW);
    return cohorts[row]?.retention[col] === undefined ? null : { row, col };
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, from: Cell) => {
    const step = STEPS[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    // The average row is the last row for the keyboard.
    const order = [...cohorts.keys(), -1];
    const index = Math.min(
      order.length - 1,
      Math.max(0, order.indexOf(from.row) + step[0])
    );
    const row = order[index];
    const width = row < 0 ? avg.length : cohorts[row].retention.length;
    const col = Math.min(width - 1, Math.max(0, from.col + step[1]));
    const next = { row, col };
    setFocus(next);
    setHover(next);
    tileRefs.current.get(`${row}:${col}`)?.focus();
  };

  const lit = (cell: Cell) => {
    if (!active) {
      return true;
    }
    if (chart) {
      return active.row === cell.row;
    }
    return active.row === cell.row || active.col === cell.col;
  };

  const tile = (cell: Cell, v: number, label: string) => {
    const key = `${cell.row}:${cell.col}`;
    return (
      <Tile
        active={active?.row === cell.row && active?.col === cell.col}
        chart={chart}
        delay={(chart ? cell.col : months - 1 - cell.col) * STAGGER_MS}
        dy={chart ? yOf(v) - (rowTop(cell.row) + ROW / 2) : 0}
        isAvg={cell.row < 0}
        key={key}
        label={label}
        lit={lit(cell)}
        onFocus={() => {
          setFocus(cell);
          setHover(cell);
        }}
        onKeyDown={(event) => moveFocus(event, cell)}
        onSelect={() => setHover(cell)}
        quiet={active !== null}
        ref={(node) => {
          if (node) {
            tileRefs.current.set(key, node);
          } else {
            tileRefs.current.delete(key);
          }
        }}
        style={{
          left: `calc(${(cell.col / months) * 100}% + ${GAP / 2}px)`,
          width: `calc(${100 / months}% - ${GAP}px)`,
          top: rowTop(cell.row) + GAP / 2,
          height: ROW - GAP,
        }}
        tabbable={focus.row === cell.row && focus.col === cell.col}
        value={v}
      />
    );
  };

  // Lines join the dots once they land.
  const linePath = (values: number[]) =>
    values
      .map((v, m) => `${m ? "L" : "M"}${((m + 0.5) / months) * 1000} ${yOf(v)}`)
      .join(" ");

  return (
    <div
      className={cn(
        "w-full max-w-xl select-none rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
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
        <div className="relative flex shrink-0 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-900">
          <span
            aria-hidden
            className="absolute top-0.5 bottom-0.5 left-0.5 w-14 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700"
            style={{ transform: `translateX(${chart ? 100 : 0}%)` }}
          />
          {(["table", "chart"] as const).map((v) => (
            <button
              aria-pressed={view === v}
              className={cn(
                "relative w-14 rounded-full py-1 font-medium capitalize outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                view === v
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
              key={v}
              onClick={() => {
                setView(v);
                setHover(null);
              }}
              type="button"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex">
        {/* Cohort names in the table, the percentage scale on the chart. */}
        <div className="relative w-12 shrink-0 text-xs sm:w-24">
          <div className="h-6" />
          <div className="relative" style={{ height: plotH }}>
            {cohorts.map((c, r) => (
              <div
                className={cn(
                  "absolute inset-x-0 flex flex-col justify-center leading-tight transition-opacity duration-200 ease-out",
                  chart && "pointer-events-none"
                )}
                key={c.label}
                style={{
                  top: r * ROW,
                  height: ROW,
                  opacity: faceOpacity(chart, !active || active.row === r),
                }}
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
                  {count.format(c.users)}
                </span>
              </div>
            ))}
            <div
              className="absolute inset-x-0 flex items-center font-medium transition-opacity duration-200 ease-out"
              style={{
                top: rowTop(-1),
                height: ROW,
                opacity: chart ? 0 : 1,
              }}
            >
              Average
            </div>
            {TICKS.map((t) => (
              <span
                aria-hidden
                className="absolute right-3 -translate-y-1/2 text-[10px] text-zinc-400 tabular-nums transition-opacity ease-out dark:text-zinc-500"
                key={t}
                style={{
                  top: yOf(t),
                  opacity: chart ? 1 : 0,
                  transitionDuration: "200ms",
                  transitionDelay: chart ? `${MORPH_MS * 0.6}ms` : "0ms",
                }}
              >
                {percent(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-6 text-[10px] text-zinc-400 dark:text-zinc-500">
            {Array.from({ length: months }, (_, m) => `M${m}`).map(
              (name, m) => (
                <span
                  className={cn(
                    "flex-1 text-center tabular-nums transition-colors duration-150",
                    active?.col === m && "text-zinc-900 dark:text-zinc-100"
                  )}
                  key={name}
                >
                  {name}
                </span>
              )
            )}
          </div>
          <div
            className="relative"
            onPointerLeave={() => setHover(null)}
            onPointerMove={(event) => setHover(cellFrom(event))}
            ref={plotRef}
            style={{ height: plotH }}
          >
            {/* Chart grid; it sits under the tiles and only shows on the chart. */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox={`0 0 1000 ${plotH}`}
            >
              {TICKS.map((t) => (
                <line
                  className="stroke-zinc-100 transition-opacity duration-200 dark:stroke-zinc-900"
                  key={t}
                  style={{
                    opacity: chart ? 1 : 0,
                    transitionDelay: chart ? `${MORPH_MS * 0.6}ms` : "0ms",
                  }}
                  vectorEffect="non-scaling-stroke"
                  x1={0}
                  x2={1000}
                  y1={yOf(t)}
                  y2={yOf(t)}
                />
              ))}
              {cohorts.map((c, r) => (
                <path
                  className={cn(
                    "fill-none transition-[stroke-dashoffset,opacity,stroke] motion-reduce:transition-none",
                    active?.row === r
                      ? "stroke-teal-600 dark:stroke-teal-400"
                      : "stroke-zinc-300 dark:stroke-zinc-700"
                  )}
                  d={linePath(c.retention)}
                  key={c.label}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeLinejoin="round"
                  strokeWidth={active?.row === r ? 2 : 1.25}
                  style={{
                    strokeDashoffset: chart ? 0 : 1,
                    // Older cohorts fade back, so the trend reads at a glance.
                    opacity: lineOpacity(r, rows, chart, active),
                    transitionDuration: chart ? "420ms" : "120ms",
                    transitionTimingFunction: EASE_OUT,
                    transitionDelay:
                      chart && !active ? `${MORPH_MS + r * 30}ms` : "0ms",
                  }}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                className="fill-none stroke-teal-600 transition-[stroke-dashoffset,opacity] motion-reduce:transition-none dark:stroke-teal-400"
                d={linePath(avg)}
                pathLength={1}
                strokeDasharray="1 1"
                strokeLinejoin="round"
                strokeWidth={2.25}
                style={{
                  strokeDashoffset: chart ? 0 : 1,
                  opacity: lineOpacity(-1, rows, chart, active),
                  transitionDuration: chart ? "520ms" : "120ms",
                  transitionTimingFunction: EASE_OUT,
                  transitionDelay:
                    chart && !active ? `${MORPH_MS + 120}ms` : "0ms",
                }}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {cohorts.flatMap((c, r) =>
              c.retention
                .slice(0, months)
                .map((v, m) =>
                  tile(
                    { row: r, col: m },
                    v,
                    `${c.label} cohort, month ${m}: ${percent(v)}`
                  )
                )
            )}
            {avg.map((v, m) =>
              tile({ row: -1, col: m }, v, `Average, month ${m}: ${percent(v)}`)
            )}
            {/* The table's hairline above the average row. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-px bg-zinc-100 transition-opacity duration-200 dark:bg-zinc-900"
              style={{ top: rows * ROW + GAP, opacity: chart ? 0 : 1 }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-zinc-100 border-t pt-3 text-xs dark:border-zinc-900">
        <p
          aria-live="polite"
          className="line-clamp-2 min-h-8 min-w-0 text-zinc-500 sm:line-clamp-1 sm:min-h-0 dark:text-zinc-400"
        >
          {readoutFor(cohorts, avg, active, subtitle)}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
          {chart ? (
            <>
              <span className="h-0.5 w-3 rounded-full bg-teal-600 dark:bg-teal-400" />
              Average
            </>
          ) : (
            <>
              0%
              <span className="h-1.5 w-12 rounded-full bg-gradient-to-r from-teal-600/5 to-teal-600 dark:from-teal-400/5 dark:to-teal-400" />
              100%
            </>
          )}
        </span>
      </div>
    </div>
  );
}
