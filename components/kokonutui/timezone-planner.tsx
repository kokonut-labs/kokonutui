"use client";

/**
 * @author: @dorianbaffier
 * @description: Time Zone Planner
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const DAY = 1440;
const STEP = 15;
const MIN_DURATION = 30;
const MAX_DURATION = 480;
// Local hours that count as asleep, whatever the working day is.
const NIGHT_FROM = 22;
const NIGHT_TO = 7;
const HANDLE_PX = 8;
const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const DIGIT = /\d/;
const OFFSET = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/;
const GLIDE = { type: "spring", duration: 0.45, bounce: 0.12 } as const;

export interface PlannerPerson {
  id: string;
  name: string;
  city: string;
  /** IANA zone, such as "America/New_York". */
  timeZone: string;
  /** Start of their working day, in local hours. */
  workStart?: number;
  /** End of their working day, in local hours. */
  workEnd?: number;
}

export interface PlannerSlot {
  start: Date;
  end: Date;
  /** Ids of the people for whom the whole slot is in working hours. */
  available: string[];
}

export interface TimezonePlannerProps {
  /** The first person is "you": the axis runs on their clock. */
  people?: PlannerPerson[];
  /** The day to plan. Defaults to today. */
  date?: Date;
  /** Start of the meeting in minutes after midnight, on the first person's clock. */
  defaultStart?: number;
  /** Length of the meeting in minutes. */
  defaultDuration?: number;
  /** Called when the slot settles: after a drag, a key press or Best time. */
  onChange?: (slot: PlannerSlot) => void;
  className?: string;
}

const DEFAULT_PEOPLE: PlannerPerson[] = [
  { id: "you", name: "You", city: "Paris", timeZone: "Europe/Paris" },
  {
    id: "lucas",
    name: "Lucas Moreau",
    city: "New York",
    timeZone: "America/New_York",
  },
  {
    id: "maya",
    name: "Maya Chen",
    city: "San Francisco",
    timeZone: "America/Los_Angeles",
  },
  {
    id: "priya",
    name: "Priya Nair",
    city: "Bengaluru",
    timeZone: "Asia/Kolkata",
  },
  { id: "aiko", name: "Aiko Tanaka", city: "Tokyo", timeZone: "Asia/Tokyo" },
];

type Status = "working" | "early" | "late" | "asleep";

const STATUS_LABEL: Record<Status, string> = {
  working: "Working",
  early: "Early",
  late: "Late",
  asleep: "Asleep",
};

const STATUS_TEXT: Record<Status, string> = {
  working: "text-emerald-600 dark:text-emerald-400",
  early: "text-zinc-500 dark:text-zinc-400",
  late: "text-zinc-500 dark:text-zinc-400",
  asleep: "text-zinc-400 dark:text-zinc-500",
};

interface Day {
  /** Each person's offset from the first person, in minutes. */
  shifts: number[];
  /** Short labels such as "−9h" or "+3h30". */
  shiftLabels: string[];
  weekday: number;
  label: string;
  /** Minutes after midnight on your clock, when the day is today. */
  now: number | null;
  /** The instant of midnight on your clock, for building Dates. */
  midnight: number;
}

interface Segment {
  from: number;
  to: number;
  kind: "work" | "night" | "off";
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const snap = (v: number) => Math.round(v / STEP) * STEP;
const mod = (v: number, m: number) => ((v % m) + m) % m;
const pad = (n: number) => String(n).padStart(2, "0");

function clock(minutes: number) {
  const m = mod(Math.round(minutes), DAY);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function offsetOf(timeZone: string, at: Date) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = OFFSET.exec(name);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function shiftLabel(shift: number) {
  if (shift === 0) {
    return "same time";
  }
  const sign = shift > 0 ? "+" : "−";
  const abs = Math.abs(shift);
  const minutes = abs % 60;
  return `${sign}${Math.floor(abs / 60)}h${minutes ? pad(minutes) : ""}`;
}

/** Wall-clock fields of an instant in a zone. */
function fieldsIn(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

function buildDay(people: PlannerPerson[], date: Date, today: Date): Day {
  const ref = people[0]?.timeZone ?? "UTC";
  const f = fieldsIn(ref, date);
  // Noon on the planned day, so the offsets are that day's (DST included).
  const noon = new Date(Date.UTC(f.year, f.month - 1, f.day, 12));
  const refOffset = offsetOf(ref, noon);
  const shifts = people.map(
    (person) => offsetOf(person.timeZone, noon) - refOffset
  );
  const t = fieldsIn(ref, today);
  const sameDay = t.year === f.year && t.month === f.month && t.day === f.day;
  return {
    shifts,
    shiftLabels: shifts.map(shiftLabel),
    weekday: f.weekday,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: ref,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(noon),
    now: sameDay ? t.minutes : null,
    midnight: Date.UTC(f.year, f.month - 1, f.day) - refOffset * 60_000,
  };
}

function kindAt(local: number, start: number, end: number): Segment["kind"] {
  const hour = mod(local, DAY) / 60;
  if (hour >= start && hour < end) {
    return "work";
  }
  if (hour >= NIGHT_FROM || hour < NIGHT_TO) {
    return "night";
  }
  return "off";
}

/** The bar for one person, cut wherever their day changes kind. */
function segmentsFor(person: PlannerPerson, shift: number): Segment[] {
  const start = person.workStart ?? 9;
  const end = person.workEnd ?? 18;
  const segments: Segment[] = [];
  for (let m = 0; m < DAY; m += STEP) {
    const kind = kindAt(m + shift, start, end);
    const last = segments.at(-1);
    if (last && last.kind === kind) {
      last.to = m + STEP;
    } else {
      segments.push({ from: m, to: m + STEP, kind });
    }
  }
  return segments;
}

function statusFor(
  person: PlannerPerson,
  shift: number,
  start: number,
  duration: number
): Status {
  const workStart = (person.workStart ?? 9) * 60;
  const workEnd = (person.workEnd ?? 18) * 60;
  const local = start + shift;
  const day = Math.floor(local / DAY) * DAY;
  if (local >= day + workStart && local + duration <= day + workEnd) {
    return "working";
  }
  const kind = kindAt(local, workStart / 60, workEnd / 60);
  if (kind === "night") {
    return "asleep";
  }
  return mod(local, DAY) < workStart ? "early" : "late";
}

/** Minutes of the slot that fall outside someone's working day. */
function outsideMinutes(
  person: PlannerPerson,
  shift: number,
  start: number,
  duration: number
) {
  let outside = 0;
  const workStart = person.workStart ?? 9;
  const workEnd = person.workEnd ?? 18;
  for (let m = start; m < start + duration; m += STEP) {
    if (kindAt(m + shift, workStart, workEnd) !== "work") {
      outside += STEP;
    }
  }
  return outside;
}

/** The slot that keeps the most people inside their working day. */
function bestStart(
  people: PlannerPerson[],
  shifts: number[],
  duration: number
) {
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let s = 0; s <= DAY - duration; s += STEP) {
    let score = 0;
    people.forEach((person, i) => {
      const shift = shifts[i] ?? 0;
      if (statusFor(person, shift, s, duration) === "working") {
        score += 10_000;
      }
      score -= outsideMinutes(person, shift, s, duration);
    });
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

const KIND_BASE: Record<Segment["kind"], string> = {
  work: "bg-emerald-500/15 dark:bg-emerald-400/15",
  off: "bg-zinc-100 dark:bg-white/[0.04]",
  night: "bg-zinc-200/70 dark:bg-white/[0.09]",
};

const KIND_LIT: Record<Segment["kind"], string> = {
  work: "bg-emerald-500 dark:bg-emerald-400",
  off: "bg-zinc-300 dark:bg-zinc-600",
  night: "bg-zinc-400 dark:bg-zinc-500",
};

/** Each digit rolls on its own wheel; separators sit still. */
function Rolling({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[1.25em] align-top tabular-nums leading-[1.25em]"
    >
      {chars.map((char, i) => {
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          return (
            <span className="whitespace-pre" key={`s${key}`}>
              {char}
            </span>
          );
        }
        return (
          <span
            className="relative inline-block h-[1.25em] overflow-hidden leading-[1.25em]"
            key={`d${key}`}
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(char) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span className="block h-[1.25em] leading-[1.25em]" key={d}>
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

function Track({
  segments,
  shift,
  weekday,
  clip,
}: {
  segments: Segment[];
  shift: number;
  weekday: number;
  clip: MotionValue<string>;
}) {
  // Where their clock passes midnight, so you can see the day change.
  const midnight = mod(-shift, DAY);
  const crossing = midnight > 0 && midnight < DAY;
  const nextDay = WEEKDAYS[mod(weekday + (shift > 0 ? 1 : 0), 7)];
  const bars = (lit: boolean) =>
    segments.map((segment) => (
      <span
        className={cn(
          "absolute inset-y-0",
          lit ? KIND_LIT[segment.kind] : KIND_BASE[segment.kind]
        )}
        key={segment.from}
        style={{
          left: `${(segment.from / DAY) * 100}%`,
          width: `${((segment.to - segment.from) / DAY) * 100}%`,
        }}
      />
    ));

  return (
    <div aria-hidden="true" className="relative h-6 overflow-hidden rounded-md">
      {bars(false)}
      <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
        {bars(true)}
      </motion.div>
      {crossing && (
        <span
          className="pointer-events-none absolute inset-y-0 border-zinc-400/80 border-l dark:border-zinc-500"
          style={{ left: `${(midnight / DAY) * 100}%` }}
        >
          {midnight < DAY - 90 && (
            <span className="absolute top-1/2 left-1 -translate-y-1/2 font-medium text-[10px] text-zinc-500 leading-none dark:text-zinc-400">
              {nextDay}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

type Grab =
  | { mode: "move"; offset: number }
  | { mode: "start"; end: number }
  | { mode: "end" };

export default function TimezonePlanner({
  people = DEFAULT_PEOPLE,
  date,
  defaultStart = 16 * 60,
  defaultDuration = 60,
  onChange,
  className,
}: TimezonePlannerProps) {
  const reduceMotion = useReducedMotion();
  const [day, setDay] = useState<Day | null>(null);
  const [slot, setSlot] = useState({
    start: defaultStart,
    duration: defaultDuration,
  });
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = useMotionValue(defaultStart);
  const duration = useMotionValue(defaultDuration);
  const overlayRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<Grab | null>(null);
  const glideRef = useRef<ReturnType<typeof animate> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Offsets depend on the day (DST) and "now" on the clock, so both wait for
  // the browser rather than differ between server and client.
  const dateKey = date?.getTime();
  const peopleRef = useRef(people);
  peopleRef.current = people;
  // Keyed on the zones, so a new array with the same people doesn't rebuild.
  const zonesKey = people.map((person) => person.timeZone).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilds when the zones change, not the array
  useEffect(() => {
    const now = new Date();
    setDay(
      buildDay(
        peopleRef.current,
        dateKey === undefined ? now : new Date(dateKey),
        now
      )
    );
  }, [zonesKey, dateKey]);

  const segments = useMemo(
    () =>
      day ? people.map((person, i) => segmentsFor(person, day.shifts[i])) : [],
    [day, people]
  );

  const bandWidth = useTransform(duration, (d) => `${(d / DAY) * 100}%`);
  // A percentage translate is of the band's own width.
  const bandTransform = useTransform(
    [start, duration],
    ([s, d]: number[]) => `translateX(${(s / d) * 100}%)`
  );
  const clip = useTransform(
    [start, duration],
    ([s, d]: number[]) =>
      `inset(0 ${100 - ((s + d) / DAY) * 100}% 0 ${(s / DAY) * 100}%)`
  );

  const sync = useCallback(() => {
    setSlot({ start: snap(start.get()), duration: duration.get() });
  }, [start, duration]);
  useMotionValueEvent(start, "change", sync);
  useMotionValueEvent(duration, "change", sync);

  const commit = useCallback(
    (s: number, d: number) => {
      if (!day) {
        return;
      }
      onChangeRef.current?.({
        start: new Date(day.midnight + s * 60_000),
        end: new Date(day.midnight + (s + d) * 60_000),
        available: people
          .filter(
            (person, i) => statusFor(person, day.shifts[i], s, d) === "working"
          )
          .map((person) => person.id),
      });
    },
    [day, people]
  );

  const glideTo = useCallback(
    (target: number) => {
      glideRef.current?.stop();
      const d = duration.get();
      const to = clamp(snap(target), 0, DAY - d);
      glideRef.current = animate(
        start,
        to,
        reduceMotion ? { duration: 0 } : GLIDE
      );
      commit(to, d);
    },
    [start, duration, reduceMotion, commit]
  );

  const minuteAt = (clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return clamp(((clientX - rect.left) / rect.width) * DAY, 0, DAY);
  };

  const grabFor = (clientX: number): Grab | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    const s = start.get();
    const d = duration.get();
    const left = rect.left + (s / DAY) * rect.width;
    const right = rect.left + ((s + d) / DAY) * rect.width;
    // The handles reach outside the band, and only a little way in, so a
    // short meeting still has a middle to grab.
    const inside = Math.min(HANDLE_PX / 2, (right - left) / 4);
    if (clientX >= left - HANDLE_PX && clientX <= left + inside) {
      return { mode: "start", end: s + d };
    }
    if (clientX >= right - inside && clientX <= right + HANDLE_PX) {
      return { mode: "end" };
    }
    if (clientX > left && clientX < right) {
      return { mode: "move", offset: minuteAt(clientX) - s };
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!day || grabRef.current || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const grab = grabFor(event.clientX);
    if (grab) {
      glideRef.current?.stop();
      grabRef.current = grab;
    } else {
      // A press on the empty track brings the meeting there, then keeps
      // following the pointer if it drags on.
      const d = duration.get();
      glideTo(minuteAt(event.clientX) - d / 2);
      grabRef.current = { mode: "move", offset: d / 2 };
    }
    setDragging(true);
    setHover(null);
  };

  const dragTo = (m: number, grab: Grab) => {
    const s = start.get();
    const d = duration.get();
    if (grab.mode === "move") {
      start.set(clamp(m - grab.offset, 0, DAY - d));
    } else if (grab.mode === "end") {
      duration.set(
        clamp(snap(m - s), MIN_DURATION, Math.min(MAX_DURATION, DAY - s))
      );
    } else {
      const next = clamp(
        snap(m),
        Math.max(0, grab.end - MAX_DURATION),
        grab.end - MIN_DURATION
      );
      start.set(next);
      duration.set(grab.end - next);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const grab = grabRef.current;
    if (grab) {
      glideRef.current?.stop();
      dragTo(minuteAt(event.clientX), grab);
      return;
    }
    if (event.pointerType === "mouse") {
      setHover(minuteAt(event.clientX));
    }
  };

  const onPointerUp = () => {
    if (!grabRef.current) {
      return;
    }
    grabRef.current = null;
    setDragging(false);
    // The band follows the pointer freely, then settles on the quarter hour.
    glideTo(start.get());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const d = duration.get();
    const s = snap(start.get());
    const step = event.shiftKey ? 60 : STEP;
    const moves: Record<string, number> = {
      ArrowLeft: s - step,
      ArrowDown: s - step,
      ArrowRight: s + step,
      ArrowUp: s + step,
      Home: 0,
      End: DAY - d,
    };
    if (!(event.key in moves)) {
      return;
    }
    event.preventDefault();
    // Keys move instantly: they repeat too often to animate.
    glideRef.current?.stop();
    const to = clamp(moves[event.key], 0, DAY - d);
    start.set(to);
    commit(to, d);
  };

  const resize = (by: number) => {
    const s = snap(start.get());
    const d = clamp(
      duration.get() + by,
      MIN_DURATION,
      Math.min(MAX_DURATION, DAY - s)
    );
    duration.set(d);
    commit(s, d);
  };

  const statuses = day
    ? people.map((person, i) =>
        statusFor(person, day.shifts[i], slot.start, slot.duration)
      )
    : [];
  const available = statuses.filter((s) => s === "working").length;
  const best = day ? bestStart(people, day.shifts, slot.duration) : null;
  const atBest = best === slot.start;
  const end = slot.start + slot.duration;
  const hours = slot.duration / 60;
  const lengthLabel =
    slot.duration % 60
      ? `${hours >= 1 ? `${Math.floor(hours)} h ` : ""}${slot.duration % 60} min`
      : `${hours} h`;
  const you = people[0];

  const localRange = (i: number) => {
    const shift = day?.shifts[i] ?? 0;
    const local = slot.start + shift;
    const dayShift = Math.floor(local / DAY);
    const prefix =
      dayShift !== 0 && day
        ? `${WEEKDAYS[mod(day.weekday + dayShift, 7)]} `
        : "";
    return `${prefix}${clock(local)}–${clock(local + slot.duration)}`;
  };

  return (
    <div
      className={cn(
        "@container w-full max-w-2xl select-none rounded-2xl bg-white @md:p-5 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10",
        className
      )}
    >
      <header className="flex items-center gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            Find a time
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {day ? day.label : " "} · {people.length} people
          </p>
        </div>
        <button
          className="ml-auto h-8 rounded-lg px-3 font-medium text-sm text-zinc-700 ring-1 ring-black/10 transition-colors duration-150 ease-out hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-default disabled:text-zinc-400 disabled:hover:bg-transparent dark:text-zinc-200 dark:ring-white/15 dark:disabled:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-white dark:disabled:hover:bg-transparent"
          disabled={best === null || atBest}
          onClick={() => best !== null && glideTo(best)}
          type="button"
        >
          {atBest ? "Best time" : "Find best time"}
        </button>
      </header>

      <div
        className="mt-4 grid @md:grid-cols-[10.5rem_minmax(0,1fr)] grid-cols-[7.5rem_minmax(0,1fr)] @md:gap-x-4 gap-x-3"
        style={{ gridTemplateRows: `20px repeat(${people.length}, 48px)` }}
      >
        {/* Axis, on your clock */}
        <div
          aria-hidden="true"
          className="relative col-start-2 row-start-1 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500"
        >
          {AXIS_HOURS.map((hour) => (
            <span
              className={cn(
                "absolute top-0 -translate-x-1/2 first:translate-x-0",
                hour % 6 !== 0 && "@md:inline hidden"
              )}
              key={hour}
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {pad(hour)}
            </span>
          ))}
          {hover !== null && !dragging && (
            <span
              className="absolute -top-0.5 z-10 -translate-x-1/2 rounded bg-zinc-900 px-1 py-0.5 font-medium text-white leading-none dark:bg-white dark:text-zinc-900"
              style={{ left: `${(hover / DAY) * 100}%` }}
            >
              {clock(snap(hover))}
            </span>
          )}
        </div>

        {people.map((person, i) => (
          <PersonLabel
            index={i}
            key={person.id}
            person={person}
            range={day ? localRange(i) : ""}
            shiftLabel={day?.shiftLabels[i] ?? ""}
            status={statuses[i]}
          />
        ))}

        {people.map((person, i) => (
          <div
            className="col-start-2 flex items-center"
            key={person.id}
            style={{ gridRowStart: i + 2 }}
          >
            <div
              className={cn(
                "w-full transition-opacity duration-200 ease-out",
                day ? "opacity-100" : "opacity-0"
              )}
            >
              {day && (
                <Track
                  clip={clip}
                  segments={segments[i] ?? []}
                  shift={day.shifts[i]}
                  weekday={day.weekday}
                />
              )}
            </div>
          </div>
        ))}

        {/* The meeting, laid over every track */}
        <div
          className="relative col-start-2 touch-none"
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerLeave={() => setHover(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={overlayRef}
          style={{ gridRow: `2 / span ${people.length}` }}
        >
          {day?.now !== null && day?.now !== undefined && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 bottom-1 w-px bg-orange-500/70"
              style={{ left: `${(day.now / DAY) * 100}%` }}
            >
              <span className="absolute -top-0.5 -left-[2.5px] size-1.5 rounded-full bg-orange-500" />
            </span>
          )}
          {hover !== null && !dragging && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1.5 w-px bg-zinc-900/25 dark:bg-white/30"
              style={{ left: `${(hover / DAY) * 100}%` }}
            />
          )}
          <motion.div
            aria-label="Meeting time"
            aria-valuemax={DAY - slot.duration}
            aria-valuemin={0}
            aria-valuenow={slot.start}
            aria-valuetext={`${clock(slot.start)} to ${clock(end)} ${you?.city ?? ""} time, ${available} of ${people.length} in working hours`}
            className={cn(
              "group/band absolute inset-y-1.5 left-0 rounded-lg border-[1.5px] border-zinc-900 outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white dark:focus-visible:ring-offset-zinc-900",
              dragging ? "cursor-grabbing" : "cursor-grab",
              !day && "opacity-0"
            )}
            onKeyDown={onKeyDown}
            role="slider"
            style={{ width: bandWidth, transform: bandTransform }}
            tabIndex={0}
          >
            <Handle side="left" />
            <Handle side="right" />
          </motion.div>
        </div>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-black/5 border-t pt-3 text-xs dark:border-white/10">
        <span className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
          <Rolling value={`${clock(slot.start)}–${clock(end)}`} />
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {you?.city ?? "Your"} time
        </span>
        <div className="flex items-center rounded-lg ring-1 ring-black/10 dark:ring-white/15">
          <StepButton
            disabled={slot.duration <= MIN_DURATION}
            label="Shorter"
            onClick={() => resize(-STEP)}
          >
            −
          </StepButton>
          <span className="min-w-16 text-center text-zinc-700 tabular-nums dark:text-zinc-200">
            {lengthLabel}
          </span>
          <StepButton
            disabled={slot.duration >= MAX_DURATION || end >= DAY}
            label="Longer"
            onClick={() => resize(STEP)}
          >
            +
          </StepButton>
        </div>
        <span
          aria-live="polite"
          className={cn(
            "ml-auto transition-colors duration-150",
            available === people.length
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          <span className="font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
            {day ? available : "–"}
          </span>{" "}
          of {people.length} in working hours
        </span>
      </footer>
    </div>
  );
}

function PersonLabel({
  person,
  index,
  status,
  range,
  shiftLabel: shift,
}: {
  person: PlannerPerson;
  index: number;
  status?: Status;
  range: string;
  shiftLabel: string;
}) {
  return (
    <div
      className="col-start-1 flex min-w-0 flex-col justify-center"
      style={{ gridRowStart: index + 2 }}
      title={person.name}
    >
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate font-medium text-[13px] text-zinc-900 leading-5 dark:text-zinc-100">
          {person.city}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
          {index === 0 ? "You" : shift}
        </span>
      </span>
      <span
        className={cn(
          "flex min-w-0 items-baseline gap-1.5 text-[11px] text-zinc-500 leading-4 transition-colors duration-150 dark:text-zinc-400",
          status && STATUS_TEXT[status]
        )}
      >
        {range ? <Rolling value={range} /> : "\u00a0"}
        {status && (
          <span className="@md:inline hidden truncate">
            · {STATUS_LABEL[status]}
          </span>
        )}
      </span>
      <span className="sr-only">
        {person.name}, {range} {status ? STATUS_LABEL[status] : ""}
      </span>
    </div>
  );
}

function Handle({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-y-0 flex w-3 cursor-ew-resize items-center justify-center",
        side === "left" ? "-left-1.5" : "-right-1.5"
      )}
    >
      <span className="h-4 w-[3px] rounded-full bg-zinc-900 opacity-0 transition-opacity duration-150 group-hover/band:opacity-100 group-focus-visible/band:opacity-100 dark:bg-white" />
    </span>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-lg text-sm text-zinc-500 transition-colors duration-150 ease-out hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-default disabled:text-zinc-300 dark:text-zinc-400 dark:disabled:text-zinc-600 dark:hover:text-white"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
