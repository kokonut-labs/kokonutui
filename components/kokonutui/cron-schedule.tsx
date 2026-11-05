"use client";

/**
 * @author: @kokonutui
 * @description: Cron Schedule
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Field = "minute" | "hour" | "day" | "month" | "weekday";

const FIELDS: { key: Field; label: string; min: number; max: number }[] = [
  { key: "minute", label: "min", min: 0, max: 59 },
  { key: "hour", label: "hour", min: 0, max: 23 },
  { key: "day", label: "day", min: 1, max: 31 },
  { key: "month", label: "month", min: 1, max: 12 },
  { key: "weekday", label: "week", min: 0, max: 6 },
];

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
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const PRESETS = [
  { label: "Every 15 min", expr: "*/15 * * * *" },
  { label: "Weekdays 09:30", expr: "30 9 * * 1-5" },
  { label: "Nightly", expr: "0 2 * * *" },
  { label: "Twice a month", expr: "0 8 1,15 * *" },
];

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const DAYS_SHOWN = 7;
// Above this many runs a day, ticks merge into a band.
const TICK_LIMIT = 96;
const FIRST_RENDER = "2026-11-05T14:47:00Z";
// The dial's handle moves in steps of this many minutes.
const SNAP = 5;
const SPACES = /\s+/;
const STEP = /^(.+)\/(\d+)$/;
const RANGE = /^(\w+)-(\w+)$/;
const DIGITS = /^\d+$/;

interface FieldSet {
  values: Set<number>;
  all: boolean;
}
type Parsed = FieldSet | { error: string };
type Sets = Record<Field, FieldSet>;

function toNumber(token: string, field: Field): number {
  const named = NAMES[token.toLowerCase()];
  if (named !== undefined && (field === "month" || field === "weekday")) {
    return named;
  }
  return DIGITS.test(token) ? Number(token) : Number.NaN;
}

/** One comma-separated piece as [from, to, step], or null when invalid. */
function parsePiece(
  piece: string,
  key: Field,
  min: number,
  max: number
): [number, number, number] | null {
  const stepMatch = piece.match(STEP);
  const body = stepMatch ? stepMatch[1] : piece;
  const step = stepMatch ? Number(stepMatch[2]) : 1;
  if (body === "*") {
    return step >= 1 ? [min, max, step] : null;
  }
  const range = body.match(RANGE);
  const from = toNumber(range ? range[1] : body, key);
  let to = range ? toNumber(range[2], key) : from;
  if (stepMatch && !range) {
    to = max;
  }
  // Cron accepts 7 for Sunday at the end of a range.
  if (key === "weekday" && to === 7 && from !== 7) {
    to = 6;
  }
  const valid =
    step >= 1 && from >= min && to <= max && from <= to && !Number.isNaN(from);
  return valid ? [from, to, step] : null;
}

/** One cron field: `*`, `5`, `1-5`, `*\/15`, `1,15`, `MON-FRI`. */
function parseField(raw: string, index: number): Parsed {
  const { key, min, max, label } = FIELDS[index];
  const text = raw.trim();
  if (!text) {
    return { error: `The ${label} field is empty` };
  }
  const values = new Set<number>();
  for (const piece of text.split(",")) {
    if (key === "weekday" && (piece === "7" || piece.endsWith("-7"))) {
      values.add(0);
      if (piece === "7") {
        continue;
      }
    }
    const parsed = parsePiece(piece, key, min, max);
    if (!parsed) {
      return { error: `${capitalize(label)} must be ${min}–${max}` };
    }
    const [from, to, step] = parsed;
    for (let v = from; v <= to; v += step) {
      values.add(v);
    }
  }
  return { values, all: values.size === max - min + 1 };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, "0");
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);
const last = (values: number[]) => values.at(-1) ?? values[0];

function joinWords(words: string[]) {
  if (words.length < 2) {
    return words.join("");
  }
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

const isContiguous = (values: number[]) =>
  values.length > 1 && last(values) - values[0] === values.length - 1;

/** Contiguous runs as "Monday through Friday", others listed. */
function describeList(values: number[], name: (n: number) => string) {
  if (values.length > 2 && isContiguous(values)) {
    return `${name(values[0])} through ${name(last(values))}`;
  }
  return joinWords(values.map(name));
}

/** A step pattern starting at the field's minimum, e.g. every 15. */
function stepOf(values: number[], min: number) {
  if (values.length < 3 || values[0] !== min) {
    return null;
  }
  const step = values[1] - values[0];
  return values.every((v, i) => v === min + i * step) ? step : null;
}

interface Phrase {
  text: string;
  fields: Field[];
}

/** "from 09:00 to 17:59", or the hours listed. */
function hourWindow(hours: number[]) {
  if (isContiguous(hours)) {
    return `from ${pad(hours[0])}:00 to ${pad(last(hours))}:59`;
  }
  return `during hour ${joinWords(hours.map(pad))}`;
}

/** Minute and hour read together, e.g. "At 09:30" or "Every 15 minutes". */
function describeTime(minute: FieldSet, hour: FieldSet) {
  const minutes = sorted(minute.values);
  const hours = sorted(hour.values);
  const window = hour.all ? "" : ` ${hourWindow(hours)}`;
  const step = stepOf(minutes, 0);
  if (minute.all) {
    return `Every minute${window}`;
  }
  if (step) {
    return `Every ${step} minutes${window}`;
  }
  const pastHour = joinWords(minutes.map((m) => `:${pad(m)}`));
  if (hour.all) {
    return minutes.length === 1 && minutes[0] === 0
      ? "Every hour, on the hour"
      : `At ${pastHour} past every hour`;
  }
  const hourStep = stepOf(hours, 0);
  if (hourStep) {
    return `At ${pastHour} past every ${hourStep} hours`;
  }
  if (hours.length * minutes.length <= 4) {
    const times = hours.flatMap((h) =>
      minutes.map((m) => `${pad(h)}:${pad(m)}`)
    );
    return `At ${joinWords(times)}`;
  }
  return `At ${pastHour} past every hour${window}`;
}

function describeWeekdays(weekdays: number[]) {
  if (weekdays.length === 2 && weekdays[0] === 0 && weekdays[1] === 6) {
    return "on weekends";
  }
  const list = describeList(weekdays, (n) => WEEKDAYS[n]);
  return weekdays.length === 1 ? `on ${list}` : list;
}

function describe(sets: Sets): Phrase[] {
  const phrases: Phrase[] = [
    { text: describeTime(sets.minute, sets.hour), fields: ["minute", "hour"] },
  ];
  const days = sorted(sets.day.values);
  const dayText = `on day${days.length > 1 ? "s" : ""} ${joinWords(days.map(String))} of the month`;
  const weekdayText = describeWeekdays(sorted(sets.weekday.values));

  if (sets.day.all && sets.weekday.all) {
    phrases.push({ text: "every day", fields: ["day", "weekday"] });
  } else if (sets.weekday.all) {
    phrases.push({ text: dayText, fields: ["day"] });
  } else if (sets.day.all) {
    phrases.push({ text: weekdayText, fields: ["weekday"] });
  } else {
    // Cron runs when either day field matches.
    phrases.push({ text: dayText, fields: ["day"] });
    phrases.push({ text: `or ${weekdayText}`, fields: ["weekday"] });
  }

  if (!sets.month.all) {
    phrases.push({
      text: `in ${describeList(sorted(sets.month.values), (n) => MONTHS[n - 1])}`,
      fields: ["month"],
    });
  }
  return phrases;
}

/** Whether a day runs at all, by its date, month and weekday. */
function dayRuns(sets: Sets, t: Date) {
  if (!sets.month.values.has(t.getUTCMonth() + 1)) {
    return false;
  }
  const dayOk = sets.day.values.has(t.getUTCDate());
  const weekdayOk = sets.weekday.values.has(t.getUTCDay());
  // When both day fields are restricted, cron runs if either matches.
  if (sets.day.all || sets.weekday.all) {
    return dayOk && weekdayOk;
  }
  return dayOk || weekdayOk;
}

/** Minutes of the day that run, for each of the days shown. */
function runsByDay(sets: Sets, start: number) {
  const times: number[] = [];
  for (const h of sets.hour.values) {
    for (const m of sets.minute.values) {
      times.push(h * 60 + m);
    }
  }
  times.sort((a, b) => a - b);
  return Array.from({ length: DAYS_SHOWN }, (_, d) =>
    dayRuns(sets, new Date(start + d * DAY_MS)) ? times : []
  );
}

function relative(ms: number) {
  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes < 60) {
    return `in ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `in ${hours}h ${minutes % 60}m`;
  }
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export interface CronScheduleProps {
  /** A five-field cron expression. */
  defaultValue?: string;
  /** Called with the expression whenever it is valid. */
  onChange?: (expression: string) => void;
  /** The moment "next run" counts from. Defaults to the live clock. */
  now?: Date | string;
  className?: string;
}

export default function CronSchedule({
  defaultValue = "30 9 * * 1-5",
  onChange,
  now,
  className,
}: CronScheduleProps) {
  const id = useId();
  const [parts, setParts] = useState(() => {
    const split = defaultValue.trim().split(SPACES);
    return FIELDS.map((_, i) => split[i] ?? "*");
  });
  const [active, setActive] = useState<Field | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // A fixed moment for the server render; the live clock takes over on mount.
  const [clockMs, setClockMs] = useState(() =>
    new Date(FIRST_RENDER).getTime()
  );
  useEffect(() => {
    if (now) {
      return;
    }
    setClockMs(Date.now());
    const tick = setInterval(() => setClockMs(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [now]);
  const nowMs = now ? new Date(now).getTime() : clockMs;
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const nowMinute = Math.floor((nowMs - today) / MINUTE_MS);

  const parsed = useMemo(() => parts.map(parseField), [parts]);
  const error = parsed.find((p) => "error" in p) as
    | { error: string }
    | undefined;
  const errorIndex = parsed.findIndex((p) => "error" in p);

  const sets = useMemo(() => {
    if (error) {
      return null;
    }
    return Object.fromEntries(FIELDS.map((f, i) => [f.key, parsed[i]])) as Sets;
  }, [parsed, error]);

  const phrases = useMemo(() => (sets ? describe(sets) : []), [sets]);
  const days = useMemo(
    () => (sets ? runsByDay(sets, today) : []),
    [sets, today]
  );

  const next = useMemo(() => {
    for (let d = 0; d < days.length; d++) {
      const run = days[d].find((m) => d > 0 || m > nowMinute);
      if (run !== undefined) {
        return { day: d, minute: run };
      }
    }
    return null;
  }, [days, nowMinute]);

  const commit = (nextParts: string[]) => {
    setParts(nextParts);
    if (nextParts.every((p, i) => !("error" in parseField(p, i)))) {
      onChange?.(nextParts.join(" "));
    }
  };

  const setPart = (index: number, value: string) => {
    // A space ends a field and moves on, so a whole expression can be typed.
    if (value.endsWith(" ") && value.trim()) {
      commit(parts.map((p, i) => (i === index ? value.trim() : p)));
      inputs.current[index + 1]?.focus();
      inputs.current[index + 1]?.select();
      return;
    }
    commit(parts.map((p, i) => (i === index ? value.replace(SPACES, "") : p)));
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").trim();
    const split = text.split(SPACES);
    if (split.length < 2) {
      return;
    }
    event.preventDefault();
    const nextParts = [...parts];
    split.slice(0, FIELDS.length - index).forEach((value, i) => {
      nextParts[index + i] = value;
    });
    commit(nextParts);
    inputs.current[Math.min(index + split.length, FIELDS.length) - 1]?.focus();
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    if (event.key === "ArrowLeft" && atStart && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (
      event.key === "ArrowRight" &&
      atEnd &&
      index < FIELDS.length - 1
    ) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
      inputs.current[index + 1]?.setSelectionRange(0, 0);
    } else if (event.key === "Backspace" && !input.value && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }
  };

  // One time of day (e.g. "30 9") is what the dial's handle can drag.
  const singleTime =
    sets && sets.minute.values.size === 1 && sets.hour.values.size === 1
      ? [...sets.hour.values][0] * 60 + [...sets.minute.values][0]
      : null;
  const setTime = (minute: number) =>
    commit([
      String(minute % 60),
      String(Math.floor(minute / 60)),
      ...parts.slice(2),
    ]);

  const expression = parts.join(" ");
  // Dim the sentence only when the hovered field has words of its own.
  const focusField = phrases.some((p) => active && p.fields.includes(active))
    ? active
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex w-full max-w-[40rem] flex-col items-center gap-5 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 sm:flex-row sm:items-start dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <Dial
          days={days}
          next={next}
          nowMinute={nowMinute}
          onTime={setTime}
          relativeNext={
            next
              ? relative(
                  today + next.day * DAY_MS + next.minute * MINUTE_MS - nowMs
                )
              : null
          }
          time={singleTime}
          today={today}
        />
        <div className="w-full min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <label className="font-medium text-[13px]" htmlFor={`${id}-0`}>
              Schedule
            </label>
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              UTC
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-5 gap-1.5">
            {FIELDS.map((field, i) => (
              <div className="flex flex-col items-center gap-1" key={field.key}>
                <input
                  aria-describedby={`${id}-sentence`}
                  aria-invalid={errorIndex === i || undefined}
                  aria-label={`${field.label} field`}
                  autoComplete="off"
                  className={cn(
                    "h-9 w-full min-w-0 rounded-md border bg-zinc-50 text-center font-mono text-[14px] outline-hidden transition-colors duration-150 dark:bg-zinc-900",
                    errorIndex === i
                      ? "border-red-400 text-red-600 dark:border-red-500/70 dark:text-red-400"
                      : "border-zinc-200 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600",
                    active === field.key &&
                      errorIndex !== i &&
                      "border-zinc-400 dark:border-zinc-600"
                  )}
                  id={`${id}-${i}`}
                  onBlur={() => setActive(null)}
                  onChange={(e) => setPart(i, e.target.value)}
                  onFocus={(e) => {
                    setActive(field.key);
                    e.target.select();
                  }}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={(e) => onPaste(i, e)}
                  onPointerEnter={() => setActive(field.key)}
                  onPointerLeave={(e) => {
                    if (document.activeElement !== e.currentTarget) {
                      setActive(null);
                    }
                  }}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  spellCheck={false}
                  value={parts[i]}
                />
                <span
                  className={cn(
                    "text-[10.5px] transition-colors duration-150",
                    active === field.key
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-400 dark:text-zinc-500"
                  )}
                >
                  {field.label}
                </span>
              </div>
            ))}
          </div>

          <p
            aria-live="polite"
            className="mt-3 min-h-[2.75rem] text-[14px] leading-snug"
            id={`${id}-sentence`}
          >
            {error ? (
              <span className="text-red-600 dark:text-red-400">
                {error.error}
              </span>
            ) : (
              phrases.map((phrase, i) => {
                const lit =
                  focusField !== null && phrase.fields.includes(focusField);
                return (
                  <span key={`${phrase.fields.join()}-${phrase.text}`}>
                    {i > 0 && (phrase.text.startsWith("or ") ? " " : ", ")}
                    <span
                      className={cn(
                        "rounded-[3px] decoration-1 underline-offset-[3px] transition-colors duration-150",
                        "text-zinc-800 dark:text-zinc-200",
                        focusField && "text-zinc-400 dark:text-zinc-500",
                        lit &&
                          "bg-emerald-500/10 text-emerald-700 underline decoration-emerald-500/50 dark:text-emerald-300"
                      )}
                    >
                      {phrase.text}
                    </span>
                    {i === phrases.length - 1 && "."}
                  </span>
                );
              })
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const on = preset.expr === expression;
              return (
                <button
                  aria-pressed={on}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[12px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                    on
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                  )}
                  key={preset.expr}
                  onClick={() => commit(preset.expr.split(" "))}
                  type="button"
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function formatRun(today: number, day: number, minute: number, short = false) {
  const date = new Date(today + day * DAY_MS);
  const weekday = WEEKDAYS[date.getUTCDay()].slice(0, 3);
  const label = short ? weekday : (["Today", "Tomorrow"][day] ?? weekday);
  return `${label} ${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

const SIZE = 244;
const C = SIZE / 2;
const OUTER = 98;
const RING_GAP = 9;
const TICK = 3.5;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const point = (minute: number, r: number) => {
  const a = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
  // Rounded, so the server and the browser print the same numbers.
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(C + r * Math.cos(a)), y: round(C + r * Math.sin(a)) };
};

/** An arc along ring `r` from one minute of the day to another. */
function arc(from: number, to: number, r: number) {
  const a = point(from, r);
  const b = point(Math.min(to, 1439.9), r);
  const large = to - from > 720 ? 1 : 0;
  return `M${a.x} ${a.y}A${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

const clockTime = (minute: number) =>
  `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/**
 * The week as rings on a 24-hour dial: today outside, six more days inward.
 * Every run is a tick where it falls in its day; when the schedule has one
 * time of day, a handle on the dial drags it.
 */
function Dial({
  days,
  today,
  nowMinute,
  next,
  relativeNext,
  time,
  onTime,
}: {
  days: number[][];
  today: number;
  nowMinute: number;
  next: { day: number; minute: number } | null;
  relativeNext: string | null;
  time: number | null;
  onTime: (minute: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const minuteAt = (event: PointerEvent) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) {
      return 0;
    }
    const x = ((event.clientX - box.left) / box.width) * SIZE - C;
    const y = ((event.clientY - box.top) / box.height) * SIZE - C;
    const turn = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const minute = Math.round(((turn / (Math.PI * 2)) * 1440) / SNAP) * SNAP;
    return minute % 1440;
  };

  const onKey = (event: KeyboardEvent<SVGGElement>) => {
    if (time === null) {
      return;
    }
    const step = event.shiftKey ? 60 : SNAP;
    const delta: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
    };
    if (delta[event.key] !== undefined) {
      event.preventDefault();
      onTime((time + delta[event.key] + 1440) % 1440);
    }
  };

  const shownDay = hoverDay ?? next?.day ?? null;
  const shownDate =
    shownDay === null ? null : new Date(today + shownDay * DAY_MS);
  const hoverRuns = hoverDay === null ? [] : (days[hoverDay] ?? []);
  const handle = time === null ? null : point(time, OUTER);

  return (
    <div className="relative w-[244px] max-w-full shrink-0">
      <svg
        aria-label="Runs over the next seven days"
        className="block h-auto w-full touch-none select-none"
        onPointerLeave={() => setHoverDay(null)}
        ref={svg}
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {[0, 360, 720, 1080].map((m) => {
          const at = point(m, OUTER + 14);
          return (
            <text
              className="fill-zinc-400 font-mono text-[9px] dark:fill-zinc-500"
              dominantBaseline="central"
              key={m}
              textAnchor="middle"
              x={at.x}
              y={at.y}
            >
              {pad(m / 60)}
            </text>
          );
        })}
        {HOURS.map((h) => {
          const a = point(h * 60, OUTER + 6);
          const b = point(h * 60, OUTER + (h % 6 === 0 ? 9 : 7.5));
          return (
            <line
              className="stroke-zinc-300 dark:stroke-zinc-700"
              key={h}
              x1={a.x}
              x2={b.x}
              y1={a.y}
              y2={b.y}
            />
          );
        })}

        {days.map((runs, d) => {
          const r = OUTER - d * RING_GAP;
          const dense = runs.length > TICK_LIMIT;
          const lit = hoverDay === d;
          return (
            <g
              className={cn(
                "transition-opacity duration-150",
                hoverDay !== null && !lit && "opacity-35"
              )}
              // Days are fixed positions on the dial.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={d}
              onPointerEnter={() => setHoverDay(d)}
            >
              <circle
                className="fill-none stroke-zinc-100 dark:stroke-zinc-800/80"
                cx={C}
                cy={C}
                r={r}
                strokeWidth={RING_GAP - 3}
              />
              {d === 0 && nowMinute > 0 && (
                <path
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  d={arc(0, nowMinute, r)}
                  fill="none"
                  strokeWidth={1.5}
                />
              )}
              {dense && runs.length > 0 ? (
                <path
                  className="stroke-zinc-500 dark:stroke-zinc-400"
                  d={arc(runs[0], last(runs) + 1, r)}
                  fill="none"
                  strokeWidth={3}
                />
              ) : (
                runs.map((m, k) => (
                  <line
                    className={cn(
                      "stroke-zinc-800 transition-transform duration-300 ease-out dark:stroke-zinc-200",
                      d === 0 &&
                        m <= nowMinute &&
                        "stroke-zinc-300 dark:stroke-zinc-600"
                    )}
                    // Ticks keep their order, so a new time sweeps them round.
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    key={k}
                    strokeLinecap="round"
                    strokeWidth={2}
                    style={{
                      transform: `rotate(${m / 4}deg)`,
                      transformOrigin: `${C}px ${C}px`,
                      transitionDuration: dragging ? "0ms" : undefined,
                    }}
                    x1={C}
                    x2={C}
                    y1={C - r - TICK}
                    y2={C - r + TICK}
                  />
                ))
              )}
            </g>
          );
        })}

        {next && (
          <circle
            className="fill-emerald-500 stroke-white transition-all duration-300 dark:stroke-zinc-950"
            cx={point(next.minute, OUTER - next.day * RING_GAP).x}
            cy={point(next.minute, OUTER - next.day * RING_GAP).y}
            r={3.5}
            strokeWidth={1.5}
          />
        )}

        {handle && (
          <g
            aria-label="Time of day"
            aria-valuemax={1435}
            aria-valuemin={0}
            aria-valuenow={time ?? 0}
            aria-valuetext={clockTime(time ?? 0)}
            className="cursor-grab outline-hidden active:cursor-grabbing [&:focus-visible>circle]:stroke-zinc-400"
            onKeyDown={onKey}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (dragging) {
                onTime(minuteAt(e));
              }
            }}
            onPointerUp={() => setDragging(false)}
            role="slider"
            tabIndex={0}
          >
            <circle cx={handle.x} cy={handle.y} fill="transparent" r={16} />
            <circle
              className="fill-white stroke-zinc-900 dark:fill-zinc-950 dark:stroke-zinc-100"
              cx={handle.x}
              cy={handle.y}
              r={dragging ? 7.5 : 6.5}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, filter: "blur(0px)" }}
            className="flex flex-col items-center"
            exit={{ opacity: 0, filter: "blur(2px)" }}
            initial={{ opacity: 0, filter: "blur(2px)" }}
            key={`${hoverDay}-${dragging ? time : next?.minute}-${next?.day}`}
            transition={{ duration: 0.15 }}
          >
            {dragging && time !== null && (
              <span className="font-mono text-[18px] tabular-nums">
                {clockTime(time)}
              </span>
            )}
            {!dragging && hoverDay !== null && shownDate && (
              <>
                <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500">
                  {WEEKDAYS[shownDate.getUTCDay()].slice(0, 3)}{" "}
                  {shownDate.getUTCDate()}
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {hoverRuns.length === 0 && "No runs"}
                  {hoverRuns.length === 1 && clockTime(hoverRuns[0])}
                  {hoverRuns.length > 1 && `${hoverRuns.length} runs`}
                </span>
              </>
            )}
            {!dragging && hoverDay === null && next && (
              <>
                <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500">
                  Next run
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {formatRun(today, next.day, next.minute, true)}
                </span>
                <span className="text-[10.5px] text-emerald-600 tabular-nums dark:text-emerald-400">
                  {relativeNext}
                </span>
              </>
            )}
            {!dragging && hoverDay === null && !next && (
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
                No runs this week
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
