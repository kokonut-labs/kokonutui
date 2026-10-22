"use client";

/**
 * @author: @dorianbaffier
 * @description: Stay Picker
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** Height of one week row, in px. The pill is drawn in the same units. */
const ROW = 52;

export interface Night {
  price: number;
  /** Sold out: you can't sleep here this night, but you can check out. */
  blocked?: boolean;
}

export interface StayPickerProps {
  /** First month shown, as YYYY-MM. */
  month?: string;
  /** Price and availability for one night, by date (YYYY-MM-DD). */
  getNight?: (date: string) => Night;
  /** Fewest nights one booking can be. */
  minNights?: number;
  currency?: string;
  onReserve?: (stay: {
    checkIn: string;
    checkOut: string;
    total: number;
  }) => void;
  className?: string;
}

/** Days since 1970, so ranges can cross months. */
const dayOf = (y: number, m: number, d: number) => Date.UTC(y, m, d) / DAY_MS;

const isoOf = (day: number) =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

const shortDate = (day: number) => {
  const date = new Date(day * DAY_MS);
  return `${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
};

/** Seeded so the server and the browser price the same night the same way. */
function demoNight(iso: string): Night {
  const [y, m, d] = iso.split("-").map(Number);
  const day = dayOf(y, m - 1, d);
  let seed = (day * 7919) % 2_147_483_647;
  seed = (seed * 16_807) % 2_147_483_647;
  const weekday = (new Date(day * DAY_MS).getUTCDay() + 6) % 7;
  const weekend = weekday === 4 || weekday === 5;
  const price = 150 + (weekend ? 45 : 0) + (seed % 7) * 8;
  return { price, blocked: seed % 11 === 0 };
}

function useMonth(initial: string) {
  const [y, m] = initial.split("-").map(Number);
  return useState({ year: y, month: m - 1 });
}

interface Segment {
  row: number;
  from: number;
  to: number;
  roundLeft: boolean;
  roundRight: boolean;
}

const ARROW_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * Where a stay from `from` can end if you aim for `to`: it can't run
 * through a sold-out night, and it can't be shorter than the minimum.
 */
function settleStay(
  from: number,
  to: number,
  minNights: number,
  blocked: (day: number) => boolean | undefined
): { end: number | null; note: string | null } {
  let end = to;
  let note: string | null = null;
  for (let d = from; d < to; d++) {
    if (blocked(d)) {
      end = d;
      note = `Sold out from ${shortDate(d)}`;
      break;
    }
  }
  if (end - from >= minNights) {
    return { end, note };
  }
  for (let d = from; d < from + minNights; d++) {
    if (blocked(d)) {
      return {
        end: null,
        note: `${minNights}-night minimum, and ${shortDate(d)} is sold out`,
      };
    }
  }
  return {
    end: from + minNights,
    note:
      to - from < minNights
        ? `${minNights}-night minimum, so we added a night`
        : note,
  };
}

/**
 * One row of the pill as a clip over a full-width bar, so it grows and
 * shrinks on the GPU. Ends are round only where the stay starts or stops.
 */
function clipFor(s: Segment) {
  const left = (s.from / 7) * 100;
  const right = 100 - ((s.to + 1) / 7) * 100;
  const l = s.roundLeft ? "22px" : "0px";
  const r = s.roundRight ? "22px" : "0px";
  return `inset(0% ${right}% 0% ${left}% round ${l} ${r} ${r} ${l})`;
}

/** The stay, cut into one segment per week row it crosses. */
function segmentsFor(
  start: number | null,
  end: number | null,
  first: number,
  daysIn: number,
  lead: number
) {
  const segments: Segment[] = [];
  if (start === null || end === null) {
    return segments;
  }
  const a = Math.max(start, first);
  const b = Math.min(end, first + daysIn - 1);
  const ia = a - first + lead;
  const ib = b - first + lead;
  for (
    let row = Math.floor(ia / 7);
    a <= b && row <= Math.floor(ib / 7);
    row++
  ) {
    const from = Math.max(ia, row * 7);
    const to = Math.min(ib, row * 7 + 6);
    segments.push({
      row,
      from: from % 7,
      to: to % 7,
      roundLeft: from === ia && a === start,
      roundRight: to === ib && b === end,
    });
  }
  return segments;
}

function summaryFor(start: number | null, end: number | null) {
  if (start === null) {
    return "Pick a check-in night";
  }
  if (end === null) {
    return `Check-in ${shortDate(start)}. Now pick check-out`;
  }
  return `${shortDate(start)} – ${shortDate(end)} · ${end - start} nights`;
}

function dayTone(edge: boolean, blocked: boolean | undefined) {
  if (edge) {
    return "";
  }
  return blocked
    ? "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-600 dark:decoration-zinc-700"
    : "text-zinc-900 dark:text-zinc-100";
}

function priceTone(edge: boolean, cheap: boolean) {
  if (edge) {
    return "text-white/70 dark:text-zinc-900/60";
  }
  return cheap
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-zinc-400 dark:text-zinc-500";
}

function DayCell({
  day,
  cell,
  label,
  night,
  cheap,
  edge,
  hoverEnd,
  inStay,
  focusable,
  money,
  onKeyDown,
}: {
  day: number;
  cell: number;
  label: number;
  night: Night;
  cheap: number;
  edge: boolean;
  hoverEnd: boolean;
  inStay: boolean;
  focusable: boolean;
  money: (n: number) => string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, day: number) => void;
}) {
  return (
    <button
      aria-label={`${shortDate(day)}, ${night.blocked ? "sold out" : `${money(night.price)} a night`}`}
      aria-pressed={edge}
      className="group absolute flex flex-col items-center justify-center outline-none"
      data-day={day}
      onKeyDown={(event) => onKeyDown(event, day)}
      style={{
        left: `${((cell % 7) / 7) * 100}%`,
        top: Math.floor(cell / 7) * ROW,
        width: `${100 / 7}%`,
        height: ROW,
      }}
      tabIndex={focusable ? 0 : -1}
      type="button"
    >
      <span
        className={cn(
          "relative flex size-11 flex-col items-center justify-center rounded-full leading-none transition-colors duration-150",
          "group-focus-visible:ring-2 group-focus-visible:ring-zinc-400",
          edge && "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
          hoverEnd && "ring-1 ring-zinc-900 ring-inset dark:ring-zinc-100",
          !(edge || inStay || night.blocked) &&
            "group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900"
        )}
      >
        {night.blocked && !edge && (
          <span
            aria-hidden="true"
            className="absolute inset-1 rounded-full text-zinc-200 dark:text-zinc-800"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 5px)",
            }}
          />
        )}
        <span
          className={cn(
            "relative font-medium text-[13px] tabular-nums",
            dayTone(edge, night.blocked)
          )}
        >
          {label}
        </span>
        {!night.blocked && (
          <span
            className={cn(
              "relative mt-1 text-[10px] tabular-nums",
              priceTone(edge, night.price <= cheap)
            )}
          >
            {night.price}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * A date range for booking stays. Every night shows its price, sold-out
 * nights are hatched, and the stay is drawn as one pill that wraps from
 * row to row as you drag across the weeks.
 */
export default function StayPicker({
  month: initialMonth = "2026-11",
  getNight = demoNight,
  minNights = 2,
  currency = "$",
  onReserve,
  className,
}: StayPickerProps) {
  const [view, setView] = useMonth(initialMonth);
  const [direction, setDirection] = useState(1);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(noteTimer.current), []);

  const first = dayOf(view.year, view.month, 1);
  const daysIn = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const lead = (new Date(first * DAY_MS).getUTCDay() + 6) % 7;
  const rows = Math.ceil((lead + daysIn) / 7);
  const nights = new Map<number, Night>();
  const nightOf = (day: number) => {
    let night = nights.get(day);
    if (!night) {
      night = getNight(isoOf(day));
      nights.set(day, night);
    }
    return night;
  };

  const days = Array.from({ length: daysIn }, (_, i) => first + i);
  const prices = days
    .filter((d) => !nightOf(d).blocked)
    .map((d) => nightOf(d).price);
  // The month's lowest price is marked, so the good nights stand out.
  const cheap = prices.length ? Math.min(...prices) : 0;

  const say = (text: string) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2600);
  };

  const settle = (from: number, to: number, speak: boolean) => {
    const result = settleStay(from, to, minNights, (d) => nightOf(d).blocked);
    if (speak && result.note) {
      say(result.note);
    }
    return result.end;
  };

  const picking = start !== null && end === null;
  const shownEnd =
    picking && hover !== null && hover > start
      ? settle(start, hover, false)
      : end;

  const begin = (day: number) => {
    if (nightOf(day).blocked) {
      say("Sold out that night");
      return;
    }
    setStart(day);
    setEnd(null);
    setReserved(false);
  };

  const choose = (day: number) => {
    if (start === null || end !== null || day <= start) {
      begin(day);
      return;
    }
    const out = settle(start, day, true);
    if (out === null) {
      return;
    }
    setEnd(out);
    setHover(null);
  };

  const dayAt = (event: PointerEvent) => {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const cell = el?.closest<HTMLElement>("[data-day]");
    return cell ? Number(cell.dataset.day) : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const day = dayAt(event);
    if (day === null) {
      return;
    }
    dragging.current = true;
    // A press on a fresh day starts a stay; a press while picking ends one.
    if (start === null || end !== null || day <= start) {
      begin(day);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const day = dayAt(event);
    if (day === null) {
      return;
    }
    if (start !== null && end === null) {
      setHover(day);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    const day = dayAt(event);
    if (day !== null && start !== null && day > start && end === null) {
      choose(day);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: number) => {
    if (event.key in ARROW_STEP) {
      event.preventDefault();
      const next = day + ARROW_STEP[event.key];
      const cell = gridRef.current?.querySelector<HTMLElement>(
        `[data-day="${next}"]`
      );
      cell?.focus();
      if (start !== null && end === null) {
        setHover(next);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(day);
    }
  };

  const go = (delta: number) => {
    setDirection(delta);
    setView(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const segments = segmentsFor(start, shownEnd ?? null, first, daysIn, lead);

  const stayNights =
    start !== null && end !== null
      ? Array.from({ length: end - start }, (_, i) => nightOf(start + i).price)
      : [];
  const total = stayNights.reduce((sum, p) => sum + p, 0);
  const money = (n: number) => `${currency}${n.toLocaleString("en-US")}`;

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.35, bounce: 0 };
  const fade = { duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT };

  const summary = summaryFor(start, end);

  return (
    <div
      className={cn(
        "w-full max-w-sm select-none rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="relative h-5 flex-1 overflow-hidden">
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.p
              animate={{ opacity: 1, x: 0 }}
              className="font-medium text-sm text-zinc-900 dark:text-zinc-100"
              exit={{ opacity: 0, x: -12 * direction }}
              initial={{ opacity: 0, x: 12 * direction }}
              key={`${view.year}-${view.month}`}
              transition={fade}
            >
              {MONTHS[view.month]} {view.year}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex gap-1">
          {[-1, 1].map((delta) => (
            <button
              aria-label={delta < 0 ? "Previous month" : "Next month"}
              className="flex size-8 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              key={delta}
              onClick={() => go(delta)}
              type="button"
            >
              {delta < 0 ? (
                <ChevronLeft aria-hidden className="size-4" />
              ) : (
                <ChevronRight aria-hidden className="size-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="mt-1"
          exit={{ opacity: 0, x: -16 * direction }}
          initial={{ opacity: 0, x: 16 * direction }}
          key={`${view.year}-${view.month}`}
          transition={fade}
        >
          <div
            className="relative touch-none"
            onPointerCancel={() => {
              dragging.current = false;
            }}
            onPointerDown={onPointerDown}
            onPointerLeave={() => setHover(null)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ref={gridRef}
            style={{ height: rows * ROW }}
          >
            {/* The stay: one pill per row, ends rounded only where the stay
              really starts and stops, so it reads as a single shape. */}
            {segments.map((s) => (
              <motion.div
                animate={{ clipPath: clipFor(s), opacity: 1 }}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 h-11 bg-zinc-100 dark:bg-zinc-800/70",
                  picking && "bg-zinc-100/70 dark:bg-zinc-800/50"
                )}
                initial={{
                  clipPath: clipFor({
                    ...s,
                    to: s.from,
                    roundLeft: true,
                    roundRight: true,
                  }),
                  opacity: 0,
                }}
                key={s.row}
                style={{ top: s.row * ROW + (ROW - 44) / 2 }}
                transition={{ ...spring, opacity: fade }}
              />
            ))}

            {days.map((day, i) => (
              <DayCell
                cell={i + lead}
                cheap={cheap}
                day={day}
                edge={
                  day === start || day === end || (day === shownEnd && !picking)
                }
                focusable={day === (start ?? first)}
                hoverEnd={picking && day === shownEnd}
                inStay={
                  start !== null &&
                  shownEnd != null &&
                  day > start &&
                  day < shownEnd
                }
                key={day}
                label={i + 1}
                money={money}
                night={nightOf(day)}
                onKeyDown={onKeyDown}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="relative mt-2 h-4 px-1 text-xs">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              note
                ? "text-orange-600 dark:text-orange-400"
                : "text-zinc-500 dark:text-zinc-400"
            )}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 4 }}
            key={note ?? summary}
            transition={fade}
          >
            {note ?? summary}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-zinc-100 border-t px-1 pt-3 dark:border-zinc-900">
        <div className="min-w-0 leading-tight">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
          <div className="relative h-6 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="font-semibold text-lg text-zinc-900 tabular-nums tracking-tight dark:text-zinc-50"
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                key={total}
                transition={fade}
              >
                {total ? money(total) : "—"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <button
          aria-disabled={!total}
          className={cn(
            "h-10 shrink-0 rounded-full px-5 font-medium text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
            reserved &&
              "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
            !reserved &&
              (total
                ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600")
          )}
          onClick={() => {
            if (start === null || end === null) {
              return;
            }
            onReserve?.({ checkIn: isoOf(start), checkOut: isoOf(end), total });
            setReserved(true);
          }}
          type="button"
        >
          {reserved ? "Reserved" : "Reserve"}
        </button>
      </div>
    </div>
  );
}
