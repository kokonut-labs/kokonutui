"use client";

/**
 * @author: @dorianbaffier
 * @description: Funnel Chart
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// The plot's height, and the room above it for the first bar's label.
const H = 180;
const HEAD = 40;
const MORPH = "560ms cubic-bezier(0.65, 0, 0.35, 1)";
const DIGIT = /\d/;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export interface FunnelReason {
  label: string;
  /** People lost to this reason. */
  count: number;
}

export interface FunnelSegment {
  id: string;
  label: string;
  /** People who reached each step, in step order. */
  counts: number[];
  /** Median hours between each step and the next. */
  hours: number[];
  /** Where the people who didn't make the next step went, per gap. */
  reasons: FunnelReason[][];
}

export interface FunnelChartProps {
  title?: string;
  subtitle?: string;
  steps?: string[];
  segments?: FunnelSegment[];
  defaultSegment?: string;
  className?: string;
}

const DEFAULT_STEPS = ["Signed up", "Verified", "Activated", "Trial", "Paid"];

const reasons = (gap: string[], counts: number[]): FunnelReason[] =>
  gap.map((label, i) => ({ label, count: counts[i] }));

const REASONS = [
  ["Never opened the email", "Email bounced", "Signed up twice"],
  ["Skipped the setup", "Didn't come back", "Import failed"],
  ["Stayed on free", "Hit the import limit", "No teammates invited"],
  ["Trial ran out", "Card declined", "Cancelled in trial"],
];

const DEFAULT_SEGMENTS: FunnelSegment[] = [
  {
    id: "desktop",
    label: "Desktop",
    counts: [7630, 6410, 4910, 2420, 1390],
    hours: [0.3, 26, 70, 310],
    reasons: [
      reasons(REASONS[0], [720, 330, 170]),
      reasons(REASONS[1], [690, 560, 250]),
      reasons(REASONS[2], [1340, 760, 390]),
      reasons(REASONS[3], [590, 240, 200]),
    ],
  },
  {
    id: "mobile",
    label: "Mobile",
    counts: [4790, 3570, 2210, 910, 440],
    hours: [0.5, 41, 96, 340],
    reasons: [
      reasons(REASONS[0], [810, 260, 150]),
      reasons(REASONS[1], [700, 480, 180]),
      reasons(REASONS[2], [760, 380, 160]),
      reasons(REASONS[3], [260, 130, 80]),
    ],
  },
];

/** Everyone: both segments added up, with the medians weighted by people. */
function combine(segments: FunnelSegment[]): FunnelSegment {
  const first = segments[0];
  const total = (i: number) =>
    segments.reduce((s, seg) => s + (seg.counts[i] ?? 0), 0);
  return {
    id: "all",
    label: "All",
    counts: first.counts.map((_, i) => total(i)),
    hours: first.hours.map((_, i) => {
      const weight = total(i + 1) || 1;
      const sum = segments.reduce(
        (s, seg) => s + (seg.hours[i] ?? 0) * (seg.counts[i + 1] ?? 0),
        0
      );
      return sum / weight;
    }),
    reasons: first.reasons.map((gap, g) =>
      gap.map((r, k) => ({
        label: r.label,
        count: segments.reduce(
          (s, seg) => s + (seg.reasons[g]?.[k]?.count ?? 0),
          0
        ),
      }))
    ),
  };
}

const count = new Intl.NumberFormat("en-US");

// Written out so server and browser print the same thing.
const compact = (n: number) => {
  const k = n / 1000;
  if (k >= 9.95) {
    return `${Math.round(k)}k`;
  }
  if (k >= 1) {
    return `${k.toFixed(1)}k`;
  }
  return String(n);
};

const share = (part: number, whole: number) =>
  whole > 0 ? (part / whole) * 100 : 0;

const percent = (v: number, digits = 0) => `${v.toFixed(digits)}%`;

const duration = (hours: number) => {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 48) {
    return `${Math.round(hours)}h`;
  }
  return `${Math.round(hours / 24)}d`;
};

function RollingNumber({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // Keyed from the right, so the units stay put as the length changes.
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          // Boxed like the digits, so everything shares one baseline.
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
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[460ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
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

/** The biggest share lost between two steps: where a funnel opens up first. */
function worstGap(counts: number[]) {
  let worst = 0;
  let worstRate = -1;
  for (let i = 0; i < counts.length - 1; i++) {
    const rate = 1 - counts[i + 1] / (counts[i] || 1);
    if (rate > worstRate) {
      worst = i;
      worstRate = rate;
    }
  }
  return worst;
}

interface GapProps {
  index: number;
  from: string;
  to: string;
  /** Tops of the bars on each side, as a share of the plot from the top. */
  topA: number;
  topB: number;
  lost: number;
  rate: number;
  selected: boolean;
  onSelect: () => void;
}

/**
 * The space between two bars: the people who carried on fill the slope,
 * the ones who left are the hatched wedge above it. Pick it to read why.
 */
function Gap({
  index,
  from,
  to,
  topA,
  topB,
  lost,
  rate,
  selected,
  onSelect,
}: GapProps) {
  const a = topA * 100;
  const b = topB * 100;
  return (
    <button
      aria-label={`${from} to ${to}: ${count.format(lost)} dropped, ${percent(rate)}`}
      aria-pressed={selected}
      className="group/gap relative flex-[2] cursor-pointer outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
      data-gap={index}
      onClick={onSelect}
      style={{ height: H }}
      type="button"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-zinc-900/[0.07] dark:bg-zinc-100/[0.08]"
        style={{
          clipPath: `polygon(0% ${a}%, 100% ${b}%, 100% 100%, 0% 100%)`,
          transition: `clip-path ${MORPH}`,
        }}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 bg-[repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_5px)] transition-colors duration-200 ease-out",
          selected
            ? "text-rose-500/70 dark:text-rose-400/70"
            : "text-zinc-300 group-hover/gap:text-zinc-400 dark:text-zinc-700 dark:group-hover/gap:text-zinc-600"
        )}
        style={{
          clipPath: `polygon(0% ${a}%, 100% ${a}%, 100% ${b}%)`,
          transition: `clip-path ${MORPH}, color 200ms ease-out`,
        }}
      />
      {/* The wedge's top edge: the level the people started from. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 border-t border-dashed transition-colors duration-200",
          selected
            ? "border-rose-500/60 dark:border-rose-400/60"
            : "border-zinc-300 dark:border-zinc-700"
        )}
        style={{
          transform: `translateY(${topA * H}px)`,
          transition: `transform ${MORPH}, border-color 200ms ease-out`,
        }}
      />
    </button>
  );
}

export default function FunnelChart({
  title = "Signup funnel",
  subtitle = "Last 30 days",
  steps = DEFAULT_STEPS,
  segments = DEFAULT_SEGMENTS,
  defaultSegment = "all",
  className,
}: FunnelChartProps) {
  const options = useMemo(
    () => (segments.length > 1 ? [combine(segments), ...segments] : segments),
    [segments]
  );
  const [segmentId, setSegmentId] = useState(defaultSegment);
  const segment = options.find((s) => s.id === segmentId) ?? options[0];
  const [picked, setPicked] = useState<number | null>(null);
  const gap = picked ?? worstGap(segment.counts);

  const first = segment.counts[0] || 1;
  const last = segment.counts.at(-1) ?? 0;
  const tops = segment.counts.map((c) => 1 - c / first);
  const segmentIndex = Math.max(
    0,
    options.findIndex((s) => s.id === segment.id)
  );

  const lost = (segment.counts[gap] ?? 0) - (segment.counts[gap + 1] ?? 0);
  const lostRate = share(lost, segment.counts[gap] ?? 0);
  const why = [...(segment.reasons[gap] ?? [])].sort(
    (x, y) => y.count - x.count
  );
  const whyMax = why[0]?.count || 1;
  const overall = percent(share(last, first), 1);

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
            className="absolute top-0.5 bottom-0.5 left-0.5 w-16 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700"
            style={{ transform: `translateX(${segmentIndex * 100}%)` }}
          />
          {options.map((s) => (
            <button
              aria-pressed={s.id === segment.id}
              className={cn(
                "relative w-16 rounded-full py-1 font-medium outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                s.id === segment.id
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
              key={s.id}
              onClick={() => setSegmentId(s.id)}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="font-semibold text-3xl tracking-tight">
          <span className="sr-only">{overall}</span>
          <RollingNumber value={overall} />
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {steps[0]?.toLowerCase()} to {steps.at(-1)?.toLowerCase()},{" "}
          <span className="tabular-nums">{count.format(last)}</span> people
        </p>
      </div>

      <div className="relative mt-4" style={{ paddingTop: HEAD }}>
        <div className="flex items-end">
          {segment.counts.map((c, i) => {
            const top = tops[i];
            const conversion =
              i === 0 ? null : share(c, segment.counts[i - 1] ?? 0);
            return [
              i > 0 && (
                <Gap
                  from={steps[i - 1]}
                  index={i - 1}
                  key={`gap-${steps[i]}`}
                  lost={(segment.counts[i - 1] ?? 0) - c}
                  onSelect={() => setPicked(i - 1)}
                  rate={100 - (conversion ?? 0)}
                  selected={gap === i - 1}
                  to={steps[i]}
                  topA={tops[i - 1]}
                  topB={top}
                />
              ),
              <div
                className="relative flex-[3]"
                key={steps[i]}
                style={{ height: H }}
              >
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-0 transition-colors duration-200 ease-out",
                    gap === i || gap === i - 1
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-800 dark:bg-zinc-300"
                  )}
                  style={{
                    clipPath: `inset(${top * 100}% 0 0 0 round 6px 6px 0 0)`,
                    transition: `clip-path ${MORPH}, background-color 200ms ease-out`,
                  }}
                />
                {/* The bar's numbers ride its top. */}
                <div
                  className="absolute inset-x-0 bottom-full flex flex-col items-center pb-1.5 leading-tight"
                  style={{
                    transform: `translateY(${top * H}px)`,
                    transition: `transform ${MORPH}`,
                  }}
                >
                  <span className="font-medium text-xs tabular-nums">
                    <span className="sr-only">{count.format(c)}</span>
                    <RollingNumber value={compact(c)} />
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
                    {conversion === null ? "100%" : percent(conversion)}
                  </span>
                </div>
              </div>,
            ];
          })}
        </div>
        <div className="flex border-zinc-200 border-t pt-2 text-[11px] dark:border-zinc-800">
          {steps.map((step, i) => [
            i > 0 && (
              <span
                className={cn(
                  "invisible flex-[2] text-center text-[10px] tabular-nums transition-colors duration-200 sm:visible",
                  gap === i - 1
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
                key={`t-${step}`}
                title="Median time to the next step"
              >
                {duration(segment.hours[i - 1] ?? 0)}
              </span>
            ),
            // Labels may run into the gaps on narrow cards, where the times hide.
            <span
              className="flex flex-[3] justify-center whitespace-nowrap text-zinc-500 dark:text-zinc-400"
              key={step}
            >
              <span className="w-0 flex-none overflow-visible">
                <span className="block w-max -translate-x-1/2">{step}</span>
              </span>
            </span>,
          ])}
        </div>
      </div>

      <div className="mt-5 border-zinc-100 border-t pt-4 dark:border-zinc-900">
        <p aria-live="polite" className="text-sm">
          <span className="font-medium">
            {steps[gap]} → {steps[gap + 1]}
          </span>{" "}
          <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
            · {count.format(lost)} left ({percent(lostRate)}) · the rest took{" "}
            {duration(segment.hours[gap] ?? 0)}
          </span>
        </p>
        <ul className="mt-3 space-y-2">
          {why.map((r) => (
            <li className="flex items-center gap-3 text-xs" key={r.label}>
              <span className="w-28 shrink-0 truncate text-zinc-600 sm:w-36 dark:text-zinc-300">
                {r.label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <span
                  className="block h-full origin-left rounded-full bg-rose-500/80 transition-transform duration-[460ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-rose-400/80"
                  style={{ transform: `scaleX(${r.count / whyMax})` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                {compact(r.count)} · {percent(share(r.count, lost))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
