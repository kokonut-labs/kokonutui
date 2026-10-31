"use client";

/**
 * @author: @kokonutui
 * @description: AI Routine
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Repeat } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface RoutineSchedule {
  /** Monday is 0, Sunday is 6. */
  days: number[];
  hour: number;
  minute: number;
}

export interface AIRoutineProps {
  defaultValue?: string;
  placeholder?: string;
  /** Called with the prompt and the schedule read from it. */
  onCreate?: (prompt: string, schedule: RoutineSchedule) => void;
  className?: string;
}

interface Match {
  start: number;
  end: number;
}

interface Parsed {
  days: Set<number>;
  hour: number | null;
  minute: number;
  /** Time came from "morning" or similar, not a clock time. */
  loose: boolean;
  ranges: Match[];
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const PARTS: Record<string, number> = {
  morning: 8,
  afternoon: 14,
  evening: 18,
  night: 21,
};
/** The strip shows 6am to midnight, when routines usually run. */
const DAY_START = 6;
const DAY_HOURS = 18;

const DAY_PREFIX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const EVERY_DAY =
  /\b(?:every|each)\s+day\b|\bdaily\b|\bevery\s+(?:morning|afternoon|evening|night)\b/gi;
const WEEKDAYS = /\b(?:(?:every|on)\s+)?week\s?days?\b/gi;
const WEEKENDS = /\b(?:(?:every|on)\s+)?week\s?ends?\b/gi;
const DAY =
  /\b(?:(?:every|on)\s+)?(mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?\b/gi;
const CLOCK = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
const BARE_CLOCK = /\bat\s+(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:am|pm))/gi;
const NOON = /\b(?:at\s+)?(noon|midnight)\b/gi;
const PART = /\b(?:in\s+the\s+)?(morning|afternoon|evening|night)\b/gi;
const JOINER = /^\s*(?:(?:,|and|&)\s*)*$/i;

const DEMO =
  "Every weekday at 9am, summarize unread email from my team and post it in #standup";

const each = (re: RegExp, text: string, fn: (m: RegExpExecArray) => void) => {
  for (const m of text.matchAll(re)) {
    fn(m as RegExpExecArray);
  }
};

const range = (m: RegExpExecArray): Match => ({
  start: m.index,
  end: m.index + m[0].length,
});

/** Joins phrases that touch, or only have "and" or a comma between them. */
const merge = (text: string, ranges: Match[]) => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Match[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (
      last &&
      (r.start <= last.end || JOINER.test(text.slice(last.end, r.start)))
    ) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
};

const readDays = (text: string, days: Set<number>, ranges: Match[]) => {
  each(EVERY_DAY, text, (m) => {
    for (const d of ALL) {
      days.add(d);
    }
    ranges.push(range(m));
  });
  each(WEEKDAYS, text, (m) => {
    for (const d of [0, 1, 2, 3, 4]) {
      days.add(d);
    }
    ranges.push(range(m));
  });
  each(WEEKENDS, text, (m) => {
    days.add(5);
    days.add(6);
    ranges.push(range(m));
  });
  each(DAY, text, (m) => {
    const key = m[1].slice(0, 3).toLowerCase();
    days.add(DAY_PREFIX[key]);
    ranges.push(range(m));
  });
};

const toHour = (raw: string, meridiem?: string) => {
  const h = Number(raw) % 12;
  if (meridiem) {
    return meridiem.toLowerCase() === "pm" ? h + 12 : h;
  }
  const n = Number(raw);
  // "at 5" most likely means the afternoon.
  return n >= 1 && n <= 6 ? n + 12 : n;
};

const parse = (text: string): Parsed => {
  const days = new Set<number>();
  const ranges: Match[] = [];
  let hour: number | null = null;
  let minute = 0;
  let loose = false;

  readDays(text, days, ranges);

  each(CLOCK, text, (m) => {
    if (hour === null) {
      hour = toHour(m[1], m[3]);
      minute = Number(m[2] ?? 0);
    }
    ranges.push(range(m));
  });
  each(BARE_CLOCK, text, (m) => {
    if (Number(m[1]) > 23) {
      return;
    }
    if (hour === null) {
      hour = toHour(m[1]);
      minute = Number(m[2] ?? 0);
    }
    ranges.push(range(m));
  });
  each(NOON, text, (m) => {
    hour ??= m[1].toLowerCase() === "noon" ? 12 : 0;
    ranges.push(range(m));
  });
  each(PART, text, (m) => {
    if (hour === null) {
      hour = PARTS[m[1].toLowerCase()];
      loose = true;
    }
    ranges.push(range(m));
  });

  return {
    days,
    hour: hour === null ? null : Math.min(23, hour),
    minute: Math.min(59, minute),
    loose,
    ranges: merge(text, ranges),
  };
};

const formatTime = (hour: number, minute: number) =>
  new Date(2026, 0, 5, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

/** The next time the routine runs after `from`. */
const nextRun = (
  from: Date,
  days: Set<number>,
  hour: number,
  minute: number
) => {
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(from);
    date.setDate(from.getDate() + offset);
    date.setHours(hour, minute, 0, 0);
    const weekday = (date.getDay() + 6) % 7;
    if (days.has(weekday) && date > from) {
      return date;
    }
  }
  return null;
};

const describeDays = (days: Set<number>) => {
  if (days.size === 7) {
    return "Every day";
  }
  const list = ALL.filter((d) => days.has(d));
  if (list.join() === "0,1,2,3,4") {
    return "Weekdays";
  }
  if (list.join() === "5,6") {
    return "Weekends";
  }
  return list.map((d) => DAY_NAMES[d].slice(0, 3)).join(", ");
};

export default function AIRoutine({
  defaultValue = DEMO,
  placeholder = "What should run, and when? Like every Friday at 4pm…",
  onCreate,
  className,
}: AIRoutineProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [now, setNow] = useState<Date | null>(null);
  const [created, setCreated] = useState(false);
  const parsed = useMemo(() => parse(value), [value]);

  // The clock only exists in the browser, so the first render matches the
  // server.
  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (!created) {
      return;
    }
    const t = setTimeout(() => setCreated(false), 2200);
    return () => clearTimeout(t);
  }, [created]);

  const hasDays = parsed.days.size > 0;
  const hour = parsed.hour ?? 9;
  const ready = hasDays && value.trim().length > 0;
  const next =
    now && hasDays ? nextRun(now, parsed.days, hour, parsed.minute) : null;
  const today = now ? (now.getDay() + 6) % 7 : null;

  const create = () => {
    if (!ready) {
      return;
    }
    onCreate?.(value.trim(), {
      days: ALL.filter((d) => parsed.days.has(d)),
      hour,
      minute: parsed.minute,
    });
    setCreated(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <label
          className="flex items-center gap-2 px-4 pt-3.5 font-medium text-[12px] text-zinc-500 dark:text-zinc-400"
          htmlFor={id}
        >
          <Repeat aria-hidden="true" className="size-3.5" />
          New routine
        </label>

        <div className="relative px-4 pt-2 pb-3">
          <HighlightMirror ranges={parsed.ranges} text={value} />
          <textarea
            aria-describedby={`${id}-when`}
            className="field-sizing-content relative block min-h-12 w-full resize-none overflow-hidden bg-transparent p-0 text-[15px] text-transparent leading-6 caret-zinc-900 outline-hidden placeholder:text-zinc-400 dark:caret-zinc-100 dark:placeholder:text-zinc-500"
            id={id}
            onChange={(e) => {
              setValue(e.target.value);
              setCreated(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                create();
              }
            }}
            placeholder={placeholder}
            rows={2}
            spellCheck={false}
            value={value}
          />
        </div>

        <WeekStrip
          days={parsed.days}
          hour={hour}
          minute={parsed.minute}
          next={next ? (next.getDay() + 6) % 7 : null}
          today={today}
        />

        <footer className="flex min-h-14 items-center gap-3 border-black/[0.06] border-t px-4 py-2.5 dark:border-white/[0.08]">
          <div className="min-w-0 flex-1" id={`${id}-when`}>
            {hasDays ? (
              <>
                <p className="truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
                  {describeDays(parsed.days)} at{" "}
                  {formatTime(hour, parsed.minute)}
                  {parsed.hour === null && (
                    <span className="font-normal text-zinc-400 dark:text-zinc-500">
                      {" "}
                      · add a time
                    </span>
                  )}
                </p>
                <p className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                  {next
                    ? `Next run ${next.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}`
                    : " "}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Say when it runs, like “every Monday at 8am”
              </p>
            )}
          </div>
          <button
            className="flex h-8 min-w-[118px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 font-medium text-[13px] text-white outline-hidden transition-[background-color,opacity] duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
            disabled={!ready}
            onClick={create}
            type="button"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex items-center gap-1.5"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={created ? "done" : "idle"}
                transition={{ duration: 0.15 }}
              >
                {created && <Check aria-hidden="true" className="size-3.5" />}
                {created ? "Scheduled" : "Create routine"}
              </motion.span>
            </AnimatePresence>
          </button>
        </footer>
        <p aria-live="polite" className="sr-only">
          {created ? "Routine created" : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

/**
 * The same text under the textarea, with the parts read as a schedule
 * underlined. The textarea's own text is transparent, so this is what shows.
 */
function HighlightMirror({ text, ranges }: { text: string; ranges: Match[] }) {
  const pieces: { text: string; mark: boolean; key: string }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) {
      pieces.push({
        text: text.slice(at, r.start),
        mark: false,
        key: `t${at}`,
      });
    }
    const phrase = text.slice(r.start, r.end);
    pieces.push({ text: phrase, mark: true, key: `m${r.start}:${phrase}` });
    at = r.end;
  }
  pieces.push({ text: `${text.slice(at)} `, mark: false, key: `t${at}` });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-4 top-2 whitespace-pre-wrap break-words text-[15px] text-zinc-900 leading-6 dark:text-zinc-100"
    >
      {pieces.map((p) =>
        p.mark ? (
          <motion.span
            animate={{ backgroundSize: "100% 1.5px" }}
            className="rounded-[2px] bg-[linear-gradient(currentColor,currentColor)] bg-bottom-left bg-emerald-600/[0.08] bg-no-repeat text-emerald-700 [box-decoration-break:clone] dark:bg-emerald-400/10 dark:text-emerald-300"
            initial={{ backgroundSize: "0% 1.5px" }}
            key={p.key}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {p.text}
          </motion.span>
        ) : (
          <span key={p.key}>{p.text}</span>
        )
      )}
    </div>
  );
}

function WeekStrip({
  days,
  hour,
  minute,
  next,
  today,
}: {
  days: Set<number>;
  hour: number;
  minute: number;
  /** The day of the next run, which also shows the time. */
  next: number | null;
  today: number | null;
}) {
  const label = formatTime(hour, minute)
    .replace(" AM", "a")
    .replace(" PM", "p");
  const at = Math.min(
    1,
    Math.max(0, (hour + minute / 60 - DAY_START) / DAY_HOURS)
  );

  return (
    <div className="px-4 pb-4">
      <div className="grid grid-cols-7 gap-1.5">
        {ALL.map((d) => {
          const on = days.has(d);
          return (
            <div className="flex flex-col items-center gap-1.5" key={d}>
              <div
                className={cn(
                  "relative h-14 w-full rounded-md transition-colors duration-200",
                  on
                    ? "bg-emerald-600/[0.07] dark:bg-emerald-400/10"
                    : "bg-zinc-100/80 dark:bg-white/[0.04]"
                )}
              >
                <AnimatePresence>
                  {on && (
                    <motion.span
                      animate={{ opacity: 1, top: `${at * 100}%` }}
                      className={cn(
                        "absolute inset-x-1.5 h-[3px] -translate-y-1/2 rounded-full",
                        d === next
                          ? "bg-emerald-600 dark:bg-emerald-400"
                          : "bg-emerald-600/45 dark:bg-emerald-400/45"
                      )}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      initial={{ opacity: 0, top: `${at * 100}%` }}
                      transition={{
                        top: { type: "spring", stiffness: 380, damping: 34 },
                        opacity: { duration: 0.18, delay: d * 0.025 },
                      }}
                    />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {on && d === next && (
                    <motion.span
                      animate={{ opacity: 1, top: `${at * 100}%` }}
                      className={cn(
                        "absolute inset-x-0 text-center font-medium text-[10px] text-emerald-700 tabular-nums leading-none dark:text-emerald-300",
                        at > 0.6 ? "-translate-y-[calc(100%+5px)]" : "mt-[6px]"
                      )}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      initial={{ opacity: 0, top: `${at * 100}%` }}
                      transition={{
                        top: { type: "spring", stiffness: 380, damping: 34 },
                        opacity: { duration: 0.2, delay: 0.1 },
                      }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  d === today
                    ? "font-semibold text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              >
                {DAY_LABELS[d]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
