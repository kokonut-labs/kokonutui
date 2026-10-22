"use client";

/**
 * @author: @dorianbaffier
 * @description: Boarding Pass
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Plane } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Radius of the notches on either side of the tear line, in px. */
const NOTCH = 10;

export type FlightStatus = "on-time" | "delayed" | "gate-change" | "boarding";

export interface Flight {
  airline: string;
  number: string;
  from: { code: string; city: string; time: string };
  to: { code: string; city: string; time: string };
  date: string;
  gate: string;
  boards: string;
  seat: string;
  group: string;
  passenger: string;
  status: FlightStatus;
  /** One line under the status, like "Delayed 25 min". */
  note?: string;
}

export interface BoardingPassProps {
  /** Leave out to watch a demo flight get a gate change and a delay. */
  flight?: Flight;
  className?: string;
}

const BASE: Flight = {
  airline: "Northwind",
  number: "NW 214",
  from: { code: "LIS", city: "Lisbon", time: "10:40" },
  to: { code: "CPH", city: "Copenhagen", time: "15:05" },
  date: "Thu, 12 Nov",
  gate: "B12",
  boards: "10:05",
  seat: "14A",
  group: "2",
  passenger: "Maya Chen",
  status: "on-time",
};

const DEMO: Flight[] = [
  BASE,
  {
    ...BASE,
    gate: "B31",
    status: "gate-change",
    note: "Gate moved to B31, 6 min walk",
  },
  {
    ...BASE,
    gate: "B31",
    boards: "10:30",
    from: { ...BASE.from, time: "11:05" },
    to: { ...BASE.to, time: "15:30" },
    status: "delayed",
    note: "Delayed 25 min, late inbound aircraft",
  },
  {
    ...BASE,
    gate: "B31",
    boards: "10:30",
    from: { ...BASE.from, time: "11:05" },
    to: { ...BASE.to, time: "15:30" },
    status: "boarding",
    note: "Group 2 is boarding now",
  },
];

const STATUS: Record<FlightStatus, { label: string; tone: string }> = {
  "on-time": {
    label: "On time",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  "gate-change": {
    label: "Gate change",
    tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  },
  delayed: {
    label: "Delayed",
    tone: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  },
  boarding: {
    label: "Boarding",
    tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  },
};

/** Remembers the value before the last change, so it can sit struck under the new one. */
function usePrevious(value: string) {
  const [state, setState] = useState({
    now: value,
    was: null as string | null,
  });
  if (state.now !== value) {
    setState({ now: value, was: state.now });
  }
  return state.was;
}

/**
 * A value where only the characters that changed roll over, one after
 * another, like a departures board updating one slot.
 */
function Flap({
  value,
  className,
  reduceMotion,
}: {
  value: string;
  className?: string;
  reduceMotion: boolean;
}) {
  const was = usePrevious(value);
  let changed = 0;
  return (
    <span className={cn("inline-flex", className)}>
      <span className="sr-only">{value}</span>
      {[...value].map((char, i) => {
        const moved = was !== null && was[i] !== char;
        const order = moved ? changed++ : 0;
        return (
          <span
            aria-hidden="true"
            className="relative inline-block overflow-hidden"
            key={`${i.toString()}-${value.length}`}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ y: "0%", opacity: 1 }}
                className="inline-block whitespace-pre"
                exit={{ y: "100%", opacity: 0 }}
                initial={{ y: "-100%", opacity: 0 }}
                key={char}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.32, delay: order * 0.06, ease: EASE_OUT }
                }
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

function Field({
  label,
  value,
  previous,
  reduceMotion,
  large,
}: {
  label: string;
  value: string;
  previous: string;
  reduceMotion: boolean;
  large?: boolean;
}) {
  const changed = previous !== value;
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <Flap
        className={cn(
          "font-semibold text-zinc-900 tabular-nums tracking-tight transition-colors duration-500 dark:text-zinc-50",
          large ? "text-xl" : "text-base",
          changed && "text-orange-600 dark:text-orange-400"
        )}
        reduceMotion={reduceMotion}
        value={value}
      />
      <div className="mt-0.5 h-4">
        <AnimatePresence initial={false}>
          {changed && (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-zinc-400 tabular-nums line-through decoration-zinc-400/70 dark:text-zinc-500"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, y: -4 }}
              transition={{
                duration: reduceMotion ? 0 : 0.24,
                delay: reduceMotion ? 0 : 0.25,
                ease: EASE_OUT,
              }}
            >
              {previous}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A barcode drawn from the passenger and flight, so each pass gets its own. */
function Barcode({ seed }: { seed: string }) {
  let n = 7;
  for (const c of seed) {
    n = (n * 31 + c.charCodeAt(0)) % 2_147_483_647;
  }
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 200) {
    n = (n * 16_807) % 2_147_483_647;
    const w = 1 + (n % 3);
    n = (n * 16_807) % 2_147_483_647;
    const gap = 1 + (n % 3);
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <svg
      aria-hidden="true"
      className="h-10 w-full text-zinc-900 dark:text-zinc-100"
      preserveAspectRatio="none"
      viewBox="0 0 200 40"
    >
      {bars.map((b) => (
        <rect fill="currentColor" height="40" key={b.x} width={b.w} x={b.x} />
      ))}
    </svg>
  );
}

/**
 * A boarding pass that keeps itself current. When the gate or times change,
 * only the characters that moved roll over, the new value turns orange, and
 * the old one stays underneath, struck through, so you can see what changed.
 */
export default function BoardingPass({ flight, className }: BoardingPassProps) {
  const [step, setStep] = useState(0);
  const reduceMotion = Boolean(useReducedMotion());
  const current = flight ?? DEMO[step];
  // What the pass said when it was issued: the baseline for "changed".
  const [issued] = useState(current);
  const cardRef = useRef<HTMLDivElement>(null);
  const tearRef = useRef<HTMLDivElement>(null);
  const [tearY, setTearY] = useState(0);

  useEffect(() => {
    if (flight) {
      return;
    }
    const id = window.setInterval(
      () => setStep((s) => (s + 1) % DEMO.length),
      3200
    );
    return () => window.clearInterval(id);
  }, [flight]);

  useLayoutEffect(() => {
    const measure = () => {
      if (tearRef.current) {
        setTearY(tearRef.current.offsetTop);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const status = STATUS[current.status];
  const fade = { duration: reduceMotion ? 0 : 0.22, ease: EASE_OUT };
  const notches = `radial-gradient(circle ${NOTCH}px at 0 ${tearY}px, #0000 97%, #000 100%), radial-gradient(circle ${NOTCH}px at 100% ${tearY}px, #0000 97%, #000 100%)`;

  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <div
        className="rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        ref={cardRef}
        style={{
          maskImage: notches,
          WebkitMaskImage: notches,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-medium text-sm text-zinc-900 dark:text-zinc-100">
              <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <Plane aria-hidden className="size-3.5 -rotate-45" />
              </span>
              {current.airline}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                {current.number}
              </span>
            </p>
            <span
              className={cn(
                "relative inline-flex h-6 items-center overflow-hidden rounded-full px-2.5 font-medium text-[11px] transition-colors duration-300",
                status.tone
              )}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  initial={{ opacity: 0, y: 8 }}
                  key={status.label}
                  transition={fade}
                >
                  {status.label}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-4xl text-zinc-900 tracking-tight dark:text-zinc-50">
                {current.from.code}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {current.from.city} ·{" "}
                <Flap
                  className={cn(
                    "tabular-nums transition-colors duration-500",
                    current.from.time === issued.from.time
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-orange-600 dark:text-orange-400"
                  )}
                  reduceMotion={reduceMotion}
                  value={current.from.time}
                />
              </p>
            </div>
            <div className="mb-5 flex flex-1 items-center gap-1.5 text-zinc-300 dark:text-zinc-700">
              <span className="h-px flex-1 border-current border-t border-dashed" />
              <Plane
                aria-hidden
                className="size-3.5 rotate-45 text-zinc-400 dark:text-zinc-500"
              />
              <span className="h-px flex-1 border-current border-t border-dashed" />
            </div>
            <div className="min-w-0 text-right">
              <p className="font-semibold text-4xl text-zinc-900 tracking-tight dark:text-zinc-50">
                {current.to.code}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                <Flap
                  className={cn(
                    "tabular-nums transition-colors duration-500",
                    current.to.time === issued.to.time
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-orange-600 dark:text-orange-400"
                  )}
                  reduceMotion={reduceMotion}
                  value={current.to.time}
                />{" "}
                · {current.to.city}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-3">
            <Field
              label="Gate"
              large
              previous={issued.gate}
              reduceMotion={reduceMotion}
              value={current.gate}
            />
            <Field
              label="Boards"
              large
              previous={issued.boards}
              reduceMotion={reduceMotion}
              value={current.boards}
            />
            <Field
              label="Seat"
              large
              previous={issued.seat}
              reduceMotion={reduceMotion}
              value={current.seat}
            />
            <Field
              label="Group"
              large
              previous={issued.group}
              reduceMotion={reduceMotion}
              value={current.group}
            />
          </div>

          <div className="relative mt-2 h-4 text-xs">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="truncate text-zinc-500 dark:text-zinc-400"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                key={current.note ?? current.date}
                transition={fade}
              >
                {current.note ??
                  `${current.date} · Doors close 15 min before departure`}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* The tear line, between the notches. */}
        <div className="relative mx-4" ref={tearRef}>
          <div className="border-zinc-200 border-t-2 border-dashed dark:border-zinc-800" />
        </div>

        <div className="flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <Barcode seed={`${current.passenger}${current.number}`} />
          </div>
          <div className="shrink-0 text-right leading-tight">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Passenger
            </p>
            <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {current.passenger}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
              {current.date}
            </p>
          </div>
        </div>
      </div>

      {/* Outlines for the notches, which the mask cut out of the border. */}
      {tearY > 0 &&
        [0, 1].map((side) => (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute text-zinc-200 dark:text-zinc-800"
            height={NOTCH * 2 + 2}
            key={side}
            style={{
              top: tearY - NOTCH - 1,
              [side ? "right" : "left"]: -1,
            }}
            viewBox={`0 0 ${NOTCH + 1} ${NOTCH * 2 + 2}`}
            width={NOTCH + 1}
          >
            <path
              d={
                side
                  ? `M ${NOTCH + 1} 1 A ${NOTCH} ${NOTCH} 0 0 0 ${NOTCH + 1} ${NOTCH * 2 + 1}`
                  : `M 0 1 A ${NOTCH} ${NOTCH} 0 0 1 0 ${NOTCH * 2 + 1}`
              }
              fill="none"
              stroke="currentColor"
            />
          </svg>
        ))}
    </div>
  );
}
