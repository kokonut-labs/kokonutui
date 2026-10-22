"use client";

/**
 * @author: @dorianbaffier
 * @description: Slot Picker
 * @version: 2.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowRight, Check, Globe } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Meetings start on the quarter hour. */
const STEP = 15;
/** Height of one minute on the day rail, in px. */
const PX = 0.8;
const HATCH =
  "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 6px)";

/** Minutes from midnight. */
type Span = [number, number];

export interface SlotDay {
  /** YYYY-MM-DD */
  date: string;
  /** Hours you can be booked, in minutes from midnight, in the guest's time. */
  open: Span;
  /** Meetings already in the calendar. */
  busy: Span[];
}

export interface SlotPickerProps {
  /** Who you're booking. `offset` is their clock minus yours, in minutes. */
  host?: { name: string; title?: string; city?: string; offset?: number };
  days?: SlotDay[];
  /** Lengths offered, in minutes. */
  durations?: number[];
  /** The guest's time zone, shown under the rail. */
  timezone?: string;
  onBook?: (slot: { date: string; start: number; minutes: number }) => void;
  className?: string;
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const DEMO_DAYS: SlotDay[] = [
  {
    date: "2026-11-02",
    open: [h(9), h(17)],
    busy: [
      [h(9), h(10)],
      [h(12), h(13, 30)],
      [h(15), h(16)],
    ],
  },
  {
    date: "2026-11-03",
    open: [h(9), h(17)],
    busy: [
      [h(9), h(9, 30)],
      [h(10), h(10, 45)],
      [h(11, 30), h(12)],
      [h(13), h(14)],
      [h(16), h(17)],
    ],
  },
  {
    date: "2026-11-04",
    open: [h(9), h(13)],
    busy: [
      [h(9, 30), h(10)],
      [h(10, 30), h(11)],
      [h(11, 30), h(12)],
      [h(12, 30), h(13)],
    ],
  },
  {
    date: "2026-11-05",
    open: [h(10), h(17)],
    busy: [
      [h(11), h(12)],
      [h(14), h(14, 30)],
      [h(15, 30), h(17)],
    ],
  },
  {
    date: "2026-11-06",
    open: [h(9), h(15)],
    busy: [
      [h(9), h(11)],
      [h(12), h(12, 30)],
    ],
  },
];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const longDate = (iso: string) => {
  const date = parse(iso);
  return `${WEEKDAY[date.getUTCDay()]}, ${MONTH[date.getUTCMonth()]} ${date.getUTCDate()}`;
};

const clock = (minutes: number, suffix = true) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const twelve = hours % 12 || 12;
  const time = mins
    ? `${twelve}:${String(mins).padStart(2, "0")}`
    : `${twelve}`;
  return suffix ? `${time}${hours >= 12 ? "pm" : "am"}` : time;
};

/** "10:30 – 11am", dropping the first am/pm when both ends share it. */
const range = (start: number, minutes: number) => {
  const end = start + minutes;
  const same = start < h(12) === end <= h(12);
  return `${clock(start, !same)} – ${clock(end)}`;
};

const lengthLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;

/** Every quarter hour where the whole meeting fits. */
function startsFor(day: SlotDay, minutes: number) {
  const out: number[] = [];
  for (let t = day.open[0]; t + minutes <= day.open[1]; t += STEP) {
    if (!day.busy.some(([a, b]) => t < b && t + minutes > a)) {
      out.push(t);
    }
  }
  return out;
}

/** The start that fits closest to where the hand is. */
function nearest(starts: number[], target: number) {
  let best: number | null = null;
  for (const s of starts) {
    if (best === null || Math.abs(s - target) < Math.abs(best - target)) {
      best = s;
    }
  }
  return best;
}

function freeMinutes(day: SlotDay) {
  const busy = day.busy.reduce(
    (sum, [a, b]) =>
      sum + Math.max(0, Math.min(b, day.open[1]) - Math.max(a, day.open[0])),
    0
  );
  return day.open[1] - day.open[0] - busy;
}

function DayStrip({
  days,
  active,
  minutes,
  onPick,
  spring,
}: {
  days: SlotDay[];
  active: number;
  minutes: number;
  onPick: (index: number) => void;
  spring: object;
}) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-1">
      {days.map((d, i) => {
        const date = parse(d.date);
        const full = startsFor(d, minutes).length === 0;
        // Whole and half hours read better than 4.25h.
        const halves = Math.floor(freeMinutes(d) / 30);
        const free = `${Math.floor(halves / 2) || ""}${halves % 2 ? "½" : ""}`;
        return (
          <button
            aria-pressed={i === active}
            className={cn(
              "relative flex flex-col items-center rounded-2xl py-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed",
              i !== active && "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
            disabled={full}
            key={d.date}
            onClick={() => onPick(i)}
            type="button"
          >
            {i === active && (
              <motion.span
                className="absolute inset-0 rounded-2xl border border-zinc-900 dark:border-zinc-100"
                layoutId="slot-picker-day"
                transition={spring}
              />
            )}
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {WEEKDAY[date.getUTCDay()]}
            </span>
            <span
              className={cn(
                "font-semibold text-lg tabular-nums leading-tight",
                full
                  ? "text-zinc-300 dark:text-zinc-700"
                  : "text-zinc-900 dark:text-zinc-100"
              )}
            >
              {date.getUTCDate()}
            </span>
            <span
              className={cn(
                "text-[10px] tabular-nums leading-[14px]",
                full
                  ? "text-zinc-400 dark:text-zinc-600"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {full ? "Full" : `${free || 0}h free`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A meeting already in the calendar, or the hours outside the day. */
function Blocked({
  span,
  from,
  label,
}: {
  span: Span;
  from: number;
  label?: string;
}) {
  const height = (span[1] - span[0]) * PX;
  return (
    <div
      className={cn(
        "absolute inset-x-0 overflow-hidden text-zinc-200 dark:text-zinc-800",
        label &&
          "rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      )}
      style={{
        top: (span[0] - from) * PX,
        height,
        backgroundImage: HATCH,
      }}
    >
      {label && height >= 20 && (
        <span className="absolute top-1 left-2 font-medium text-[10px] text-zinc-500 leading-3 dark:text-zinc-400">
          {label}
        </span>
      )}
    </div>
  );
}

function ConfirmBar({
  day,
  start,
  minutes,
  host,
  booked,
  onConfirm,
  fade,
}: {
  day: SlotDay | undefined;
  start: number | null;
  minutes: number;
  host: NonNullable<SlotPickerProps["host"]>;
  booked: boolean;
  onConfirm: () => void;
  fade: object;
}) {
  const hostTime =
    start !== null && host.offset
      ? `${clock(start + host.offset)} for ${host.name.split(" ")[0]}${host.city ? ` in ${host.city}` : ""}`
      : null;
  return (
    <div className="mt-4 flex items-center gap-3 border-zinc-100 border-t pt-4 dark:border-zinc-900">
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex flex-col justify-center leading-tight"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={start === null ? "none" : "some"}
            transition={fade}
          >
            {start === null || !day ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click a free gap, then drag it to move.
              </p>
            ) : (
              <>
                <p className="truncate font-medium text-sm text-zinc-900 tabular-nums dark:text-zinc-100">
                  {longDate(day.date)} · {range(start, minutes)}
                </p>
                {hostTime && (
                  <p className="truncate text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    {hostTime}
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <button
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 font-medium text-xs outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-zinc-950",
          booked
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        )}
        disabled={start === null}
        onClick={onConfirm}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={booked ? "booked" : "confirm"}
            transition={fade}
          >
            {booked ? (
              <>
                <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                Booked
              </>
            ) : (
              <>
                Confirm
                <ArrowRight aria-hidden className="size-3.5" />
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

/**
 * Booking a meeting on a real day rail. Click a free gap and the meeting
 * lands there; drag it and it hops over what's already booked instead of
 * sliding under it. Change the length and it grows in place, moving only
 * if it no longer fits.
 */
export default function SlotPicker({
  host = {
    name: "Lena Ortiz",
    title: "Product walkthrough",
    city: "Lisbon",
    offset: 300,
  },
  days = DEMO_DAYS,
  durations = [30, 60, 90],
  timezone = "Eastern Time, New York",
  onBook,
  className,
}: SlotPickerProps) {
  const [minutes, setMinutes] = useState(durations[0] ?? 30);
  const [dayIndex, setDayIndex] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [booked, setBooked] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef(0);
  const reduceMotion = Boolean(useReducedMotion());

  const day = days[dayIndex];
  const starts = day ? startsFor(day, minutes) : [];
  const from = Math.min(...days.map((d) => d.open[0]));
  const to = Math.max(...days.map((d) => d.open[1]));
  const hours: number[] = [];
  for (let t = Math.ceil(from / 60) * 60; t <= to; t += 60) {
    hours.push(t);
  }

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.35, bounce: 0 };
  const fade = { duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT };

  /** Minutes on the rail under the pointer. */
  const minuteAt = (event: PointerEvent) => {
    const rect = railRef.current?.getBoundingClientRect();
    return rect ? from + (event.clientY - rect.top) / PX : from;
  };

  const place = (next: number | null) => {
    setStart(next);
    setBooked(false);
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const at = minuteAt(event);
    const onBlock = start !== null && at >= start && at <= start + minutes;
    // Grab the meeting where you held it; a click elsewhere drops it there.
    grabRef.current = onBlock && start !== null ? at - start : minutes / 2;
    if (!onBlock) {
      place(nearest(starts, at - minutes / 2));
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setGhost(null);
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const at = minuteAt(event);
    if (dragging) {
      const next = nearest(starts, at - grabRef.current);
      if (next !== start) {
        place(next);
      }
      return;
    }
    const over = start !== null && at >= start && at <= start + minutes;
    setGhost(
      event.pointerType === "mouse" && !over && !booked
        ? nearest(starts, at - minutes / 2)
        : null
    );
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (start === null) {
      return;
    }
    const index = starts.indexOf(start);
    const moves: Record<string, number | undefined> = {
      ArrowUp: starts[Math.max(0, index - 1)],
      ArrowDown: starts[Math.min(starts.length - 1, index + 1)],
      Home: starts[0],
      End: starts.at(-1),
    };
    if (event.key in moves) {
      event.preventDefault();
      place(moves[event.key] ?? start);
    }
  };

  const pickMinutes = (next: number) => {
    setMinutes(next);
    if (day && start !== null) {
      // Grow in place when it fits; otherwise move to the closest gap.
      const fits = startsFor(day, next);
      place(fits.includes(start) ? start : nearest(fits, start));
    }
  };

  const pickDay = (index: number) => {
    setDayIndex(index);
    place(null);
  };

  const initials = host.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 font-medium text-sky-700 text-xs dark:bg-sky-500/15 dark:text-sky-300">
          {initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {host.title}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            with {host.name}
          </p>
        </div>
      </div>

      <div className="mt-4 flex rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
        {durations.map((d) => (
          <button
            aria-pressed={d === minutes}
            className={cn(
              "relative z-10 h-8 flex-1 rounded-full font-medium text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
              d === minutes
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
            key={d}
            onClick={() => pickMinutes(d)}
            type="button"
          >
            {d === minutes && (
              <motion.span
                className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:bg-zinc-700"
                layoutId="slot-picker-length"
                transition={spring}
              />
            )}
            {lengthLabel(d)}
          </button>
        ))}
      </div>

      <DayStrip
        active={dayIndex}
        days={days}
        minutes={minutes}
        onPick={pickDay}
        spring={spring}
      />

      {/* The day: hour lines, what's taken, and the meeting you're placing. */}
      <div className="mt-4 flex gap-2">
        <div
          aria-hidden="true"
          className="relative w-9 shrink-0"
          style={{ height: (to - from) * PX }}
        >
          {hours.map((t) => (
            <span
              className="absolute right-0 -translate-y-1/2 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500"
              key={t}
              style={{ top: (t - from) * PX }}
            >
              {clock(t)}
            </span>
          ))}
        </div>
        <div
          className={cn(
            "relative flex-1 touch-none select-none",
            dragging ? "cursor-grabbing" : "cursor-pointer"
          )}
          onPointerCancel={() => setDragging(false)}
          onPointerDown={onDown}
          onPointerLeave={() => setGhost(null)}
          onPointerMove={onMove}
          onPointerUp={() => setDragging(false)}
          ref={railRef}
          style={{ height: (to - from) * PX }}
        >
          {hours.map((t) => (
            <span
              className="absolute inset-x-0 border-zinc-100 border-t dark:border-zinc-900"
              key={t}
              style={{ top: (t - from) * PX }}
            />
          ))}
          {day && day.open[0] > from && (
            <Blocked from={from} span={[from, day.open[0]]} />
          )}
          {day && day.open[1] < to && (
            <Blocked from={from} span={[day.open[1], to]} />
          )}
          {day?.busy.map((span) => (
            <Blocked
              from={from}
              key={`${day.date}-${span[0]}`}
              label="Busy"
              span={span}
            />
          ))}

          {ghost !== null && start !== ghost && (
            <div
              className="pointer-events-none absolute inset-x-0 rounded-lg border border-sky-400 border-dashed bg-sky-50/60 dark:border-sky-500/60 dark:bg-sky-500/10"
              style={{ top: (ghost - from) * PX, height: minutes * PX }}
            >
              <span className="absolute top-1 left-2 font-medium text-[10px] text-sky-700 tabular-nums leading-3 dark:text-sky-300">
                {range(ghost, minutes)}
              </span>
            </div>
          )}

          {start !== null && (
            <motion.div
              animate={{ y: (start - from) * PX, height: minutes * PX }}
              className="absolute inset-x-0 top-0"
              initial={{ y: (start - from) * PX, height: minutes * PX }}
              key={dayIndex}
              transition={spring}
            >
              <button
                aria-label={`${longDate(day?.date ?? "")}, ${range(start, minutes)}. Arrow keys move it.`}
                className={cn(
                  "flex h-full w-full items-start gap-1 overflow-hidden rounded-lg px-2 py-1 text-left font-medium text-[11px] tabular-nums leading-4 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
                  booked
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                    : "bg-sky-600 text-white shadow-[0_1px_2px_rgb(2_132_199/0.3)] dark:bg-sky-500 dark:text-sky-950",
                  !(booked || dragging) && "cursor-grab"
                )}
                onKeyDown={onKey}
                type="button"
              >
                {booked && (
                  <Check
                    aria-hidden
                    className="mt-0.5 size-3 shrink-0"
                    strokeWidth={3}
                  />
                )}
                <span className="truncate">{range(start, minutes)}</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <Globe aria-hidden className="size-3" />
        {timezone}
      </p>

      <ConfirmBar
        booked={booked}
        day={day}
        fade={fade}
        host={host}
        minutes={minutes}
        onConfirm={() => {
          if (!day || start === null || booked) {
            return;
          }
          onBook?.({ date: day.date, start, minutes });
          setBooked(true);
        }}
        start={start}
      />
    </div>
  );
}
