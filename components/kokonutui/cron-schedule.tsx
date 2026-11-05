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
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
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
  /** The moment "next run" counts from. Fixed by default so the demo is stable. */
  now?: Date | string;
  className?: string;
}

export default function CronSchedule({
  defaultValue = "30 9 * * 1-5",
  onChange,
  now = "2026-11-05T14:47:00Z",
  className,
}: CronScheduleProps) {
  const id = useId();
  const [parts, setParts] = useState(() => {
    const split = defaultValue.trim().split(SPACES);
    return FIELDS.map((_, i) => split[i] ?? "*");
  });
  const [active, setActive] = useState<Field | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const nowMs = new Date(now).getTime();
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

  const expression = parts.join(" ");
  // Dim the sentence only when the hovered field has words of its own.
  const focusField = phrases.some((p) => active && p.fields.includes(active))
    ? active
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
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

        <div className="mt-4 border-zinc-100 border-t pt-3 dark:border-zinc-800/80">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-zinc-500 dark:text-zinc-400">
              Next 7 days
            </span>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[11.5px] text-zinc-500 tabular-nums dark:text-zinc-400"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                key={next ? `${next.day}-${next.minute}` : "none"}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {next ? (
                  <>
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {formatRun(today, next.day, next.minute)}
                    </span>{" "}
                    {relative(
                      today +
                        next.day * DAY_MS +
                        next.minute * MINUTE_MS -
                        nowMs
                    )}
                  </>
                ) : (
                  "No runs this week"
                )}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="mt-2.5 flex flex-col gap-1">
            {Array.from({ length: DAYS_SHOWN }, (_, d) => {
              const date = new Date(today + d * DAY_MS);
              const runs = days[d] ?? [];
              return (
                <div
                  className="flex items-center gap-2.5"
                  key={date.toISOString()}
                >
                  <span
                    className={cn(
                      "w-11 shrink-0 font-mono text-[10.5px] tabular-nums",
                      d === 0
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400 dark:text-zinc-500"
                    )}
                  >
                    {WEEKDAYS[date.getUTCDay()].slice(0, 3)} {date.getUTCDate()}
                  </span>
                  <DayTrack
                    nextMinute={next?.day === d ? next.minute : null}
                    nowMinute={d === 0 ? nowMinute : null}
                    runs={runs}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 ml-[3.375rem] flex justify-between font-mono text-[9.5px] text-zinc-400 tabular-nums dark:text-zinc-600">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function formatRun(today: number, day: number, minute: number) {
  const date = new Date(today + day * DAY_MS);
  const label =
    ["Today", "Tomorrow"][day] ?? WEEKDAYS[date.getUTCDay()].slice(0, 3);
  return `${label} ${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function DayTrack({
  runs,
  nowMinute,
  nextMinute,
}: {
  runs: number[];
  nowMinute: number | null;
  nextMinute: number | null;
}) {
  const at = (minute: number) => `${(minute / 1440) * 100}%`;
  const dense = runs.length > TICK_LIMIT;

  return (
    <div className="relative h-4 flex-1 rounded-[3px] bg-zinc-50 dark:bg-zinc-900">
      {[6, 12, 18].map((h) => (
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-1 w-px bg-zinc-300/80 dark:bg-zinc-700"
          key={h}
          style={{ left: at(h * 60) }}
        />
      ))}
      {nowMinute !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-l-[3px] bg-zinc-200/50 dark:bg-zinc-800/60"
          style={{ width: at(nowMinute) }}
        />
      )}
      {dense ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 rounded-[2px] bg-zinc-300 dark:bg-zinc-700"
          style={{
            left: at(runs[0]),
            width: at(last(runs) - runs[0] + 1),
          }}
        />
      ) : (
        <AnimatePresence initial={false}>
          {runs.map((minute) => {
            const past = nowMinute !== null && minute <= nowMinute;
            const isNext = minute === nextMinute;
            return (
              <motion.span
                animate={{ opacity: 1, scaleY: 1 }}
                aria-hidden="true"
                className={cn(
                  "absolute top-0.5 bottom-0.5 w-0.5 origin-bottom -translate-x-1/2 rounded-full",
                  "bg-zinc-500 dark:bg-zinc-400",
                  past && "bg-zinc-300 dark:bg-zinc-700",
                  isNext && "bg-emerald-500"
                )}
                exit={{ opacity: 0, scaleY: 0 }}
                initial={{ opacity: 0, scaleY: 0 }}
                key={minute}
                style={{ left: at(minute) }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              />
            );
          })}
        </AnimatePresence>
      )}
      {nextMinute !== null && (
        <motion.span
          animate={{ opacity: 1 }}
          aria-hidden="true"
          className="absolute -top-0.5 size-1.5 -translate-x-1/2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950"
          initial={{ opacity: 0 }}
          key={nextMinute}
          style={{ left: at(nextMinute) }}
        />
      )}
    </div>
  );
}
