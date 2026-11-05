"use client";

/**
 * @author: @kokonutui
 * @description: Domain Propagation
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RotateCcw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Resolver {
  code: string;
  city: string;
  /** When it starts answering with the new record, in ms after the check. */
  at: number;
}

export interface DomainPropagationProps {
  domain?: string;
  /** The record type and the value being rolled out. */
  record?: { type: string; value: string; previous?: string };
  /** Resolvers around the ring, clockwise from the top. */
  resolvers?: Resolver[];
  className?: string;
}

const DEMO_RESOLVERS: Resolver[] = [
  { code: "SEA", city: "Seattle", at: 2100 },
  { code: "SFO", city: "San Francisco", at: 900 },
  { code: "DFW", city: "Dallas", at: 3200 },
  { code: "ORD", city: "Chicago", at: 1500 },
  { code: "IAD", city: "Washington", at: 600 },
  { code: "GRU", city: "São Paulo", at: 5200 },
  { code: "LHR", city: "London", at: 1100 },
  { code: "CDG", city: "Paris", at: 2600 },
  { code: "FRA", city: "Frankfurt", at: 800 },
  { code: "JNB", city: "Johannesburg", at: 6400 },
  { code: "DXB", city: "Dubai", at: 3900 },
  { code: "BOM", city: "Mumbai", at: 4600 },
  { code: "SIN", city: "Singapore", at: 1900 },
  { code: "HKG", city: "Hong Kong", at: 2900 },
  { code: "NRT", city: "Tokyo", at: 3500 },
  { code: "SYD", city: "Sydney", at: 5800 },
];

const SIZE = 360;
const C = SIZE / 2;
const CORE = 44;
const NODE_R = 126;
const LABEL_R = 152;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Real propagation takes minutes; the demo runs this many times faster.
const SPEEDUP = 20;

const polar = (i: number, count: number, r: number) => {
  const a = (i / count) * Math.PI * 2 - Math.PI / 2;
  // Rounded, so the server and the browser print the same numbers.
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(C + r * Math.cos(a)), y: round(C + r * Math.sin(a)) };
};

const ago = (ms: number) => {
  const s = Math.round((ms * SPEEDUP) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export default function DomainPropagation({
  domain = "acme.shop",
  record = { type: "A", value: "76.76.21.21", previous: "192.0.2.44" },
  resolvers = DEMO_RESOLVERS,
  className,
}: DomainPropagationProps) {
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-80px" });
  const last = Math.max(...resolvers.map((r) => r.at));
  const done = elapsed >= last;
  const resolved = resolvers.filter((r) => r.at <= elapsed).length;

  // The check runs on a clock; each resolver flips when its time comes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new run restarts the clock
  useEffect(() => {
    if (!inView) {
      return;
    }
    // Only re-render when a resolver flips, not on every frame.
    const times = resolvers.map((r) => r.at).sort((a, b) => a - b);
    const start = performance.now();
    let frame = 0;
    let next = 0;
    setElapsed(0);
    const tick = (now: number) => {
      const t = now - start;
      if (next < times.length && t >= times[next]) {
        while (next < times.length && t >= times[next]) {
          next += 1;
        }
        setElapsed(Math.min(t, last));
      }
      if (t < last) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, last, inView]);

  const latest = [...resolvers]
    .filter((r) => r.at <= elapsed)
    .sort((a, b) => b.at - a.at)[0];
  const progress = resolved / resolvers.length;
  const ringLength = 2 * Math.PI * (CORE + 6);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
        ref={rootRef}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <span className="font-medium text-[14px]">{domain}</span>
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {record.type} {record.value}
          </span>
          <span className="ml-auto text-[12px]">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "block",
                  done
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                )}
                exit={{ opacity: 0, y: -6 }}
                initial={{ opacity: 0, y: 6 }}
                key={done ? "done" : "running"}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {done ? "Live everywhere" : "Propagating"}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[360px]">
          <svg
            aria-label={`${resolved} of ${resolvers.length} resolvers answer with the new record`}
            className="block h-full w-full"
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            <circle
              className="fill-none stroke-zinc-200 dark:stroke-zinc-800"
              cx={C}
              cy={C}
              r={NODE_R}
              strokeDasharray="1 5"
              strokeLinecap="round"
            />

            {/* Waves leave the core while the record is still spreading. */}
            {!done &&
              [0, 1, 2].map((n) => (
                <motion.circle
                  animate={{ r: NODE_R, opacity: 0 }}
                  className="fill-none stroke-emerald-500"
                  cx={C}
                  cy={C}
                  initial={{ r: CORE, opacity: 0.45 }}
                  key={`${run}-${n}`}
                  strokeWidth={1}
                  transition={{
                    duration: 2.4,
                    delay: n * 0.8,
                    ease: "easeOut",
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              ))}
            <AnimatePresence>
              {done && (
                <motion.circle
                  animate={{ r: LABEL_R + 20, opacity: 0 }}
                  className="fill-none stroke-emerald-500"
                  cx={C}
                  cy={C}
                  initial={{ r: CORE, opacity: 0.7 }}
                  key={`final-${run}`}
                  strokeWidth={1.5}
                  transition={{ duration: 1.1, ease: EASE_OUT }}
                />
              )}
            </AnimatePresence>

            {resolvers.map((resolver, i) => {
              const inner = polar(i, resolvers.length, CORE + 8);
              const node = polar(i, resolvers.length, NODE_R);
              const label = polar(i, resolvers.length, LABEL_R);
              const on = resolver.at <= elapsed;
              const lit = hover === i;
              return (
                <g
                  className={cn(
                    "transition-opacity duration-200",
                    hover !== null && !lit && "opacity-45"
                  )}
                  key={`${run}-${resolver.code}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                >
                  <line
                    className="stroke-zinc-200 dark:stroke-zinc-800"
                    strokeDasharray="2 4"
                    x1={inner.x}
                    x2={node.x}
                    y1={inner.y}
                    y2={node.y}
                  />
                  {on && (
                    <>
                      <motion.line
                        animate={{ pathLength: 1, opacity: 0.5 }}
                        className="stroke-emerald-500"
                        initial={{ pathLength: 0, opacity: 1 }}
                        strokeWidth={1.25}
                        transition={{ duration: 0.45, ease: EASE_OUT }}
                        x1={inner.x}
                        x2={node.x}
                        y1={inner.y}
                        y2={node.y}
                      />
                      <motion.circle
                        animate={{ cx: node.x, cy: node.y, opacity: [1, 1, 0] }}
                        className="fill-emerald-500"
                        initial={{ cx: inner.x, cy: inner.y, opacity: 1 }}
                        r={2.5}
                        transition={{ duration: 0.45, ease: EASE_OUT }}
                      />
                    </>
                  )}
                  <circle cx={node.x} cy={node.y} fill="transparent" r={18} />
                  <circle
                    className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
                    cx={node.x}
                    cy={node.y}
                    r={6}
                  />
                  {!on && (
                    <motion.circle
                      animate={{ opacity: [0.25, 0.8, 0.25] }}
                      className="fill-zinc-300 dark:fill-zinc-600"
                      cx={node.x}
                      cy={node.y}
                      r={2}
                      transition={{
                        duration: 1.6,
                        delay: (i % 4) * 0.2,
                        repeat: Number.POSITIVE_INFINITY,
                      }}
                    />
                  )}
                  {on && (
                    <motion.g
                      animate={{ scale: 1 }}
                      initial={{ scale: 0.4 }}
                      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                      transition={{
                        delay: 0.35,
                        type: "spring",
                        stiffness: 500,
                        damping: 22,
                      }}
                    >
                      <circle
                        className="fill-emerald-500"
                        cx={node.x}
                        cy={node.y}
                        r={7.5}
                      />
                      <motion.path
                        animate={{ pathLength: 1 }}
                        className="stroke-white"
                        d={`M${node.x - 3} ${node.y + 0.2}l2 2 4-4.2`}
                        fill="none"
                        initial={{ pathLength: 0 }}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.6}
                        transition={{ delay: 0.5, duration: 0.25 }}
                      />
                    </motion.g>
                  )}
                  <text
                    className={cn(
                      "font-mono text-[9.5px] transition-colors duration-300",
                      on
                        ? "fill-zinc-800 dark:fill-zinc-200"
                        : "fill-zinc-400 dark:fill-zinc-600"
                    )}
                    dominantBaseline="central"
                    textAnchor="middle"
                    x={label.x}
                    y={label.y}
                  >
                    {resolver.code}
                  </text>
                </g>
              );
            })}

            <circle
              className="fill-zinc-50 stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800"
              cx={C}
              cy={C}
              r={CORE}
            />
            <circle
              className="fill-none stroke-zinc-100 dark:stroke-zinc-800/70"
              cx={C}
              cy={C}
              r={CORE + 6}
              strokeWidth={2}
            />
            <circle
              className="fill-none stroke-emerald-500 transition-[stroke-dashoffset] duration-500 ease-out"
              cx={C}
              cy={C}
              r={CORE + 6}
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - progress)}
              strokeLinecap="round"
              strokeWidth={2}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-medium text-[20px] tabular-nums leading-none">
              {resolved}
              <span className="text-zinc-400 dark:text-zinc-500">
                /{resolvers.length}
              </span>
            </span>
            <span className="mt-1 text-[10.5px] text-zinc-500 dark:text-zinc-400">
              resolvers
            </span>
          </div>

          <AnimatePresence>
            {hover !== null && (
              <Tooltip
                count={resolvers.length}
                elapsed={elapsed}
                index={hover}
                record={record}
                resolver={resolvers[hover]}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="flex h-12 items-center gap-3 border-zinc-100 border-t px-4 dark:border-zinc-800/80">
          <div className="relative min-w-0 flex-1 overflow-hidden text-[12.5px]">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                className="truncate text-zinc-600 dark:text-zinc-400"
                exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
                key={done ? "done" : (latest?.code ?? "start")}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {done && `Every resolver answers in ${ago(last)}.`}
                {!done && latest && (
                  <>
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {latest.city}
                    </span>{" "}
                    now answers {record.value}
                  </>
                )}
                {!(done || latest) && "Asking resolvers around the world…"}
              </motion.p>
            </AnimatePresence>
          </div>
          <button
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            disabled={!done}
            onClick={() => {
              setElapsed(0);
              setRun((r) => r + 1);
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Check again
          </button>
        </div>
      </div>
    </MotionConfig>
  );
}

function Tooltip({
  resolver,
  index,
  count,
  elapsed,
  record,
}: {
  resolver: Resolver;
  index: number;
  count: number;
  elapsed: number;
  record: { value: string; previous?: string };
}) {
  const on = resolver.at <= elapsed;
  const at = polar(index, count, NODE_R);
  // Above the node in the top half, below it in the bottom half.
  const below = at.y > C;
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0, y: below ? -4 : 4 }}
      style={{
        left: `${(at.x / SIZE) * 100}%`,
        top: `${(at.y / SIZE) * 100}%`,
        translate: below ? "-50% 14px" : "-50% calc(-100% - 14px)",
      }}
      transition={{ duration: 0.15 }}
    >
      <p className="font-medium">{resolver.city}</p>
      <p className="font-mono text-[11px]">
        {on ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {record.value} · after {ago(resolver.at)}
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            still {record.previous ?? "the old record"}
          </span>
        )}
      </p>
    </motion.div>
  );
}
