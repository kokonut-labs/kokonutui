"use client";

/**
 * @author: @dorianbaffier
 * @description: Slot Picker
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowRight, Check, Globe } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STEP = 30;

/** Minutes from midnight. */
type Busy = [number, number];

export interface SlotDay {
  /** YYYY-MM-DD */
  date: string;
  /** Hours you can be booked, in minutes from midnight. */
  open: [number, number];
  /** Meetings already in the calendar. */
  busy: Busy[];
}

export interface SlotPickerProps {
  /** Who you're booking. */
  host?: { name: string; title?: string };
  days?: SlotDay[];
  /** Lengths offered, in minutes. */
  durations?: number[];
  /** Shown next to the globe. */
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
      [h(10), h(10, 30)],
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
    open: [h(9), h(17)],
    busy: [
      [h(9), h(10)],
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

const clock = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 || 12;
  return mins
    ? `${twelve}:${String(mins).padStart(2, "0")}${suffix}`
    : `${twelve}${suffix}`;
};

/** Every start time on the half hour where the whole meeting fits. */
function slotsFor(day: SlotDay, minutes: number) {
  const out: number[] = [];
  for (let t = day.open[0]; t + minutes <= day.open[1]; t += STEP) {
    const clash = day.busy.some(([a, b]) => t < b && t + minutes > a);
    if (!clash) {
      out.push(t);
    }
  }
  return out;
}

/**
 * Booking a meeting: pick a day, then a time. Switch the length and the
 * times that can't fit it step out while the rest close ranks; the time you
 * pick opens in place into its confirm row.
 */
export default function SlotPicker({
  host = { name: "Lena Ortiz", title: "Product walkthrough" },
  days = DEMO_DAYS,
  durations = [30, 60, 90],
  timezone = "Central European Time",
  onBook,
  className,
}: SlotPickerProps) {
  const [minutes, setMinutes] = useState(durations[0] ?? 30);
  const [dayIndex, setDayIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [booked, setBooked] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const day = days[dayIndex];
  const slots = day ? slotsFor(day, minutes) : [];
  const counts = days.map((d) => slotsFor(d, minutes).length);
  // Room for the busiest day at the shortest length, plus the confirm row,
  // so the card never changes height as you switch.
  const mostSlots = Math.max(
    1,
    ...days.flatMap((d) => durations.map((m) => slotsFor(d, m).length))
  );
  const rows = Math.ceil(mostSlots / 3) + 1;
  const rowsHeight = rows * 44 + (rows - 1) * 6;

  const pickMinutes = (next: number) => {
    setMinutes(next);
    setBooked(false);
    // A picked time that no longer fits is let go.
    if (picked !== null && day && !slotsFor(day, next).includes(picked)) {
      setPicked(null);
    }
  };

  const pickDay = (index: number) => {
    setDayIndex(index);
    setPicked(null);
    setBooked(false);
  };

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.4, bounce: 0 };
  const fade = { duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT };
  const initials = host.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  const date = day ? parse(day.date) : null;
  const longDate = date
    ? `${WEEKDAY[date.getUTCDay()]}, ${MONTH[date.getUTCMonth()]} ${date.getUTCDate()}`
    : "";

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

      {/* Meeting length. */}
      <div className="relative mt-4 flex rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
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
            {d < 60 ? `${d} min` : `${d / 60 === 1 ? "1 hr" : `${d / 60} hr`}`}
          </button>
        ))}
      </div>

      {/* Days. The count under each one follows the length. */}
      <div className="mt-4 grid grid-cols-5 gap-1">
        {days.map((d, i) => {
          const dt = parse(d.date);
          const full = counts[i] === 0;
          const active = i === dayIndex;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-center rounded-2xl py-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
                !active && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                full && "cursor-not-allowed"
              )}
              disabled={full}
              key={d.date}
              onClick={() => pickDay(i)}
              type="button"
            >
              {active && (
                <motion.span
                  className="absolute inset-0 rounded-2xl border border-zinc-900 dark:border-zinc-100"
                  layoutId="slot-picker-day"
                  transition={spring}
                />
              )}
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {WEEKDAY[dt.getUTCDay()]}
              </span>
              <span
                className={cn(
                  "font-semibold text-lg tabular-nums leading-tight",
                  full
                    ? "text-zinc-300 dark:text-zinc-700"
                    : "text-zinc-900 dark:text-zinc-100"
                )}
              >
                {dt.getUTCDate()}
              </span>
              <span className="relative h-3.5 w-full overflow-hidden text-center text-[10px] tabular-nums">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "absolute inset-x-0 top-0 leading-[14px]",
                      full
                        ? "text-zinc-400 dark:text-zinc-600"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                    exit={{ opacity: 0, y: -8 }}
                    initial={{ opacity: 0, y: 8 }}
                    key={counts[i]}
                    transition={fade}
                  >
                    {full ? "Full" : `${counts[i]} open`}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          );
        })}
      </div>

      {/* Times. */}
      <LayoutGroup id="slot-picker">
        <motion.div
          className="mt-4 grid grid-cols-3 content-start gap-1.5"
          style={{ minHeight: rowsHeight }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {slots.map((start) => {
              const open = start === picked;
              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(open && "col-span-3")}
                  exit={{
                    opacity: 0,
                    scale: 0.94,
                    transition: { duration: reduceMotion ? 0 : 0.14 },
                  }}
                  initial={{ opacity: 0, scale: 0.94 }}
                  key={`${dayIndex}-${start}`}
                  layout="position"
                  transition={{ default: spring, opacity: fade }}
                >
                  {open ? (
                    <motion.div
                      animate={{ opacity: 1 }}
                      className="flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-zinc-900 pr-1 pl-3.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      initial={{ opacity: 0.6 }}
                      transition={fade}
                    >
                      <button
                        aria-label="Change time"
                        className="min-w-0 flex-1 truncate text-left text-sm tabular-nums outline-none"
                        onClick={() => {
                          setPicked(null);
                          setBooked(false);
                        }}
                        type="button"
                      >
                        <span className="font-medium">
                          {clock(start)} – {clock(start + minutes)}
                        </span>
                        <span className="ml-1.5 text-white/60 dark:text-zinc-900/60">
                          {longDate}
                        </span>
                      </button>
                      <button
                        className={cn(
                          "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium text-xs outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/60",
                          booked
                            ? "bg-emerald-500 text-emerald-950"
                            : "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                        )}
                        onClick={() => {
                          if (!day || booked) {
                            return;
                          }
                          onBook?.({ date: day.date, start, minutes });
                          setBooked(true);
                        }}
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
                                <Check
                                  aria-hidden
                                  className="size-3.5"
                                  strokeWidth={2.5}
                                />
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
                    </motion.div>
                  ) : (
                    <button
                      className="h-11 w-full rounded-xl border border-zinc-200 font-medium text-sm text-zinc-800 tabular-nums outline-none transition-colors duration-150 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                      onClick={() => {
                        setPicked(start);
                        setBooked(false);
                      }}
                      type="button"
                    >
                      {clock(start)}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {slots.length === 0 && (
            <p className="col-span-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Nothing {minutes} minutes long fits this day.
            </p>
          )}
        </motion.div>
      </LayoutGroup>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Globe aria-hidden className="size-3.5" />
        {timezone}
      </p>
    </div>
  );
}
