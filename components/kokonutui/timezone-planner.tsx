"use client";

/**
 * @author: @dorianbaffier
 * @description: Timezone Planner
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
  useId,
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const DIGIT = /\d/;
const OFFSET = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/;
const NON_WORD = /[^a-zA-Z0-9]/g;
const GLIDE = { type: "spring", duration: 0.5, bounce: 0.15 } as const;
const TAU = Math.PI * 2;

// Dial geometry, in viewBox units.
const SIZE = 340;
const C = SIZE / 2;
const R_OUT = 134;
const R_IN = 60;
const RING_GAP = 4;
const WEDGE_IN = R_IN - 7;
const WEDGE_OUT = R_OUT + 6;
const LABEL_R = 160;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** How far past a wedge edge (in viewBox units) still grabs that edge. */
const EDGE_REACH = 13;
/** Flick projection: how far the wedge coasts on release, in seconds of its speed. */
const COAST = 0.14;

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
  /** The first person is "you": the dial runs on their clock. */
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

type Grab =
  | { mode: "move"; offset: number }
  | { mode: "start"; end: number }
  | { mode: "end" };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const snap = (v: number) => Math.round(v / STEP) * STEP;
const mod = (v: number, m: number) => ((v % m) + m) % m;
const pad = (n: number) => String(n).padStart(2, "0");
/** The shortest way round the dial from `from` to `to`, in minutes. */
const turn = (from: number, to: number) =>
  mod(to - from + DAY / 2, DAY) - DAY / 2;
const round = (n: number) => Math.round(n * 100) / 100;

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

/** One person's ring, cut wherever their day changes kind. */
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
  for (let s = 0; s < DAY; s += STEP) {
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

/** A point on the dial: minutes run clockwise from midnight at the top. */
function polar(r: number, minutes: number) {
  const a = (minutes / DAY) * TAU;
  return [round(C + r * Math.sin(a)), round(C - r * Math.cos(a))] as const;
}

/** An annular slice between two radii and two times. */
function slice(r0: number, r1: number, from: number, to: number) {
  const span = to - from;
  if (span >= DAY) {
    return `M ${C} ${C - r1} A ${r1} ${r1} 0 1 1 ${C} ${C + r1} A ${r1} ${r1} 0 1 1 ${C} ${C - r1} M ${C} ${C - r0} A ${r0} ${r0} 0 1 0 ${C} ${C + r0} A ${r0} ${r0} 0 1 0 ${C} ${C - r0} Z`;
  }
  const large = span > DAY / 2 ? 1 : 0;
  const [ax, ay] = polar(r1, from);
  const [bx, by] = polar(r1, to);
  const [cx, cy] = polar(r0, to);
  const [dx, dy] = polar(r0, from);
  return `M ${ax} ${ay} A ${r1} ${r1} 0 ${large} 1 ${bx} ${by} L ${cx} ${cy} A ${r0} ${r0} 0 ${large} 0 ${dx} ${dy} Z`;
}

function ringBounds(index: number, count: number) {
  const width = (R_OUT - R_IN - RING_GAP * (count - 1)) / count;
  const outer = R_OUT - index * (width + RING_GAP);
  return { outer, inner: outer - width };
}

const KIND_BASE: Record<Segment["kind"], string> = {
  work: "fill-emerald-500/20 dark:fill-emerald-400/20",
  off: "fill-zinc-100 dark:fill-white/[0.05]",
  night: "fill-zinc-200 dark:fill-white/[0.1]",
};

const KIND_LIT: Record<Segment["kind"], string> = {
  work: "fill-emerald-500 dark:fill-emerald-400",
  off: "fill-zinc-300 dark:fill-zinc-600",
  night: "fill-zinc-400 dark:fill-zinc-500",
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

function Ring({
  segments,
  index,
  count,
  shift,
  lit,
}: {
  segments: Segment[];
  index: number;
  count: number;
  shift: number;
  lit: boolean;
}) {
  const { outer, inner } = ringBounds(index, count);
  // Where their clock passes midnight, so the day change shows on the ring.
  const midnight = mod(-shift, DAY);
  const [x0, y0] = polar(inner, midnight);
  const [x1, y1] = polar(outer, midnight);
  return (
    <>
      {segments.map((segment) => (
        <path
          className={lit ? KIND_LIT[segment.kind] : KIND_BASE[segment.kind]}
          d={slice(inner, outer, segment.from, segment.to)}
          key={segment.from}
        />
      ))}
      {!lit && shift !== 0 && (
        <line
          className="stroke-zinc-500 dark:stroke-zinc-400"
          strokeWidth={1.25}
          x1={x0}
          x2={x1}
          y1={y0}
          y2={y1}
        />
      )}
    </>
  );
}

function Knob({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  return (
    <motion.circle
      className="fill-white stroke-zinc-900 dark:fill-zinc-900 dark:stroke-white"
      cx={x}
      cy={y}
      r={4.5}
      strokeWidth={1.5}
    />
  );
}

export default function TimezonePlanner({
  people = DEFAULT_PEOPLE,
  date,
  defaultStart = 16 * 60,
  defaultDuration = 60,
  onChange,
  className,
}: TimezonePlannerProps) {
  const reduceMotion = useReducedMotion();
  const clipId = `tz${useId().replace(NON_WORD, "")}`;
  const [day, setDay] = useState<Day | null>(null);
  const [slot, setSlot] = useState({
    start: defaultStart,
    duration: defaultDuration,
  });
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [keyed, setKeyed] = useState(false);

  // The start runs on unbounded: a wedge dragged past midnight keeps going.
  const start = useMotionValue(defaultStart);
  const duration = useMotionValue(defaultDuration);
  const svgRef = useRef<SVGSVGElement>(null);
  const grabRef = useRef<Grab | null>(null);
  const lastRef = useRef(0);
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

  const wedge = useTransform([start, duration], ([s, d]: number[]) =>
    slice(WEDGE_IN, WEDGE_OUT, s, s + d)
  );
  const startX = useTransform(start, (s) => polar(WEDGE_OUT, s)[0]);
  const startY = useTransform(start, (s) => polar(WEDGE_OUT, s)[1]);
  const endX = useTransform(
    [start, duration],
    ([s, d]: number[]) => polar(WEDGE_OUT, s + d)[0]
  );
  const endY = useTransform(
    [start, duration],
    ([s, d]: number[]) => polar(WEDGE_OUT, s + d)[1]
  );

  const sync = useCallback(() => {
    setSlot({ start: mod(snap(start.get()), DAY), duration: duration.get() });
  }, [start, duration]);
  useMotionValueEvent(start, "change", sync);
  useMotionValueEvent(duration, "change", sync);

  const commit = useCallback(
    (s: number, d: number) => {
      if (!day) {
        return;
      }
      const from = mod(s, DAY);
      onChangeRef.current?.({
        start: new Date(day.midnight + from * 60_000),
        end: new Date(day.midnight + (from + d) * 60_000),
        available: people
          .filter(
            (person, i) =>
              statusFor(person, day.shifts[i], from, d) === "working"
          )
          .map((person) => person.id),
      });
    },
    [day, people]
  );

  /** Springs the wedge to a time, the short way round, carrying any fling. */
  const glideTo = useCallback(
    (target: number, velocity = 0) => {
      glideRef.current?.stop();
      const from = start.get();
      const to = from + turn(from, snap(target));
      glideRef.current = animate(
        start,
        to,
        reduceMotion ? { duration: 0 } : { ...GLIDE, velocity }
      );
      commit(to, duration.get());
    },
    [start, duration, reduceMotion, commit]
  );

  /** Pointer position as minutes on the dial and distance from its middle. */
  const pointAt = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { minutes: 0, r: 0 };
    }
    const scale = SIZE / rect.width;
    const dx = (clientX - rect.left) * scale - C;
    const dy = (clientY - rect.top) * scale - C;
    const angle = Math.atan2(dx, -dy);
    return { minutes: mod((angle / TAU) * DAY, DAY), r: Math.hypot(dx, dy) };
  };

  const grabFor = (minutes: number, r: number): Grab | null => {
    const s = start.get();
    const d = duration.get();
    // The edges reach a little outside the wedge and only a little way in,
    // so a short meeting still has a middle to grab.
    const reach = (EDGE_REACH / Math.max(r, R_IN)) * (DAY / TAU);
    const inside = Math.min(reach / 2, d / 4);
    const fromStart = turn(s, minutes);
    const fromEnd = turn(s + d, minutes);
    if (fromStart >= -reach && fromStart <= inside) {
      return { mode: "start", end: s + d };
    }
    if (fromEnd >= -inside && fromEnd <= reach) {
      return { mode: "end" };
    }
    const into = mod(minutes - s, DAY);
    return into < d ? { mode: "move", offset: into } : null;
  };

  const ringAt = (r: number) => {
    for (let i = 0; i < people.length; i++) {
      const { outer, inner } = ringBounds(i, people.length);
      if (r <= outer + RING_GAP / 2 && r >= inner - RING_GAP / 2) {
        return i;
      }
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!day || grabRef.current || event.button !== 0) {
      return;
    }
    const { minutes, r } = pointAt(event.clientX, event.clientY);
    // The middle holds the readout, and past the labels is outside the dial.
    if (r < WEDGE_IN - 4 || r > LABEL_R + 8) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    lastRef.current = minutes;
    const grab = grabFor(minutes, r);
    if (grab) {
      glideRef.current?.stop();
      grabRef.current = grab;
    } else {
      // A press anywhere else brings the meeting there, then keeps
      // following the pointer if it drags on.
      const d = duration.get();
      glideTo(minutes - d / 2);
      grabRef.current = { mode: "move", offset: d / 2 };
    }
    setDragging(true);
    setHover(null);
  };

  const dragTo = (minutes: number, grab: Grab) => {
    // Unwrap the pointer so crossing midnight keeps the same direction.
    const pointer = lastRef.current + turn(lastRef.current, minutes);
    lastRef.current = pointer;
    if (grab.mode === "move") {
      start.set(pointer - grab.offset);
      return;
    }
    if (grab.mode === "end") {
      const span = mod(pointer - start.get(), DAY);
      // Dragged back past the start, the meeting stays at its shortest.
      const d = span > (MAX_DURATION + DAY) / 2 ? MIN_DURATION : span;
      duration.set(clamp(snap(d), MIN_DURATION, MAX_DURATION));
      return;
    }
    const span = mod(grab.end - pointer, DAY);
    const d = clamp(
      snap(span > (MAX_DURATION + DAY) / 2 ? MIN_DURATION : span),
      MIN_DURATION,
      MAX_DURATION
    );
    start.set(grab.end - d);
    duration.set(d);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const { minutes, r } = pointAt(event.clientX, event.clientY);
    const grab = grabRef.current;
    if (grab) {
      glideRef.current?.stop();
      dragTo(minutes, grab);
      return;
    }
    if (event.pointerType !== "mouse") {
      return;
    }
    const onDial = r >= WEDGE_IN - 4 && r <= WEDGE_OUT + 4;
    setHover(onDial ? minutes : null);
    setFocus(onDial ? ringAt(r) : null);
  };

  const onPointerUp = () => {
    const grab = grabRef.current;
    if (!grab) {
      return;
    }
    grabRef.current = null;
    setDragging(false);
    if (grab.mode !== "move") {
      commit(start.get(), duration.get());
      return;
    }
    // A fling coasts on a little, then settles on the quarter hour.
    const velocity = start.getVelocity();
    const coast = clamp(velocity * COAST, -120, 120);
    glideTo(start.get() + coast, velocity);
  };

  const resize = (by: number) => {
    const d = clamp(duration.get() + by, MIN_DURATION, MAX_DURATION);
    duration.set(d);
    commit(snap(start.get()), d);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const s = snap(start.get());
    const d = duration.get();
    const step = event.shiftKey ? 60 : STEP;
    const moves: Record<string, number> = {
      ArrowLeft: s - step,
      ArrowDown: s - step,
      ArrowRight: s + step,
      ArrowUp: s + step,
      PageDown: s - 60,
      PageUp: s + 60,
    };
    if (event.key === "-" || event.key === "+" || event.key === "=") {
      event.preventDefault();
      resize(event.key === "-" ? -STEP : STEP);
      return;
    }
    if (!(event.key in moves)) {
      return;
    }
    event.preventDefault();
    // Keys move instantly: they repeat too often to animate.
    glideRef.current?.stop();
    start.set(moves[event.key]);
    commit(moves[event.key], d);
  };

  const statuses = day
    ? people.map((person, i) =>
        statusFor(person, day.shifts[i], slot.start, slot.duration)
      )
    : [];
  const available = statuses.filter((s) => s === "working").length;
  const everyone = day !== null && available === people.length;
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

      <div className="mt-4 grid @lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] grid-cols-1 items-center @lg:gap-6 gap-4">
        <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
          <svg
            aria-hidden="true"
            className={cn(
              "size-full touch-none overflow-visible",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            onPointerCancel={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerLeave={() => {
              setHover(null);
              setFocus(null);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ref={svgRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            <defs>
              <clipPath id={clipId}>
                <motion.path d={wedge} />
              </clipPath>
            </defs>

            <HourMarks />
            {day && (
              <Rings
                clipId={clipId}
                day={day}
                focus={focus}
                people={people}
                segments={segments}
              />
            )}

            {day?.now !== null && day?.now !== undefined && (
              <NowHand minutes={day.now} />
            )}
            {hover !== null && !dragging && <HoverHand minutes={hover} />}

            <g className={cn(!day && "opacity-0")}>
              <motion.path
                className={cn(
                  "fill-zinc-900/[0.03] transition-[stroke] duration-200 dark:fill-white/[0.04]",
                  everyone
                    ? "stroke-emerald-600 dark:stroke-emerald-400"
                    : "stroke-zinc-900 dark:stroke-white"
                )}
                d={wedge}
                strokeLinejoin="round"
                strokeWidth={keyed ? 2.75 : 1.5}
              />
              <Knob x={startX} y={startY} />
              <Knob x={endX} y={endY} />
            </g>
          </svg>

          {/* The readout, in the hole of the dial, is also the keyboard handle */}
          <div
            aria-label="Meeting time"
            aria-valuemax={DAY - STEP}
            aria-valuemin={0}
            aria-valuenow={slot.start}
            aria-valuetext={`${clock(slot.start)} to ${clock(end)} ${you?.city ?? ""} time, ${available} of ${people.length} in working hours`}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center outline-hidden"
            onBlur={() => setKeyed(false)}
            onFocus={(event) =>
              setKeyed(event.currentTarget.matches(":focus-visible"))
            }
            onKeyDown={onKeyDown}
            role="slider"
            tabIndex={0}
          >
            <span className="font-semibold text-[22px] text-zinc-900 leading-none tracking-tight dark:text-zinc-50">
              <Rolling value={clock(slot.start)} />
            </span>
            <span className="mt-1 text-[11px] text-zinc-500 leading-none dark:text-zinc-400">
              to <Rolling value={clock(end)} />
            </span>
            <span aria-hidden="true" className="mt-2 flex gap-1">
              {people.map((person, i) => (
                <span
                  className={cn(
                    "size-1.5 rounded-full transition-colors duration-200",
                    statuses[i] === "working"
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : "bg-zinc-200 dark:bg-zinc-700"
                  )}
                  key={person.id}
                />
              ))}
            </span>
          </div>
        </div>

        <ul className="flex flex-col">
          {people.map((person, i) => (
            <PersonRow
              count={people.length}
              dimmed={focus !== null && focus !== i}
              index={i}
              key={person.id}
              onHover={setFocus}
              person={person}
              range={day ? localRange(i) : ""}
              shiftLabel={day?.shiftLabels[i] ?? ""}
              status={statuses[i]}
            />
          ))}
        </ul>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-black/5 border-t pt-3 text-xs dark:border-white/10">
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
            disabled={slot.duration >= MAX_DURATION}
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
            everyone
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

/** Hour ticks round the rim, with a label every three hours in place of its tick. */
function HourMarks() {
  return (
    <g>
      {HOURS.map((hour) => {
        if (hour % 3 === 0) {
          const [x, y] = polar(LABEL_R - 6, hour * 60);
          return (
            <text
              className="fill-zinc-400 font-medium text-[9.5px] tabular-nums dark:fill-zinc-500"
              dominantBaseline="central"
              key={hour}
              textAnchor="middle"
              x={x}
              y={y}
            >
              {pad(hour)}
            </text>
          );
        }
        const [x0, y0] = polar(R_OUT + 11, hour * 60);
        const [x1, y1] = polar(R_OUT + 15, hour * 60);
        return (
          <line
            className="stroke-zinc-300 dark:stroke-zinc-700"
            key={hour}
            strokeWidth={1}
            x1={x0}
            x2={x1}
            y1={y0}
            y2={y1}
          />
        );
      })}
    </g>
  );
}

function Rings({
  day,
  segments,
  people,
  focus,
  clipId,
}: {
  day: Day;
  segments: Segment[][];
  people: PlannerPerson[];
  focus: number | null;
  clipId: string;
}) {
  return (
    <g
      className={cn(
        "transition-opacity duration-300 ease-out",
        "opacity-100 starting:opacity-0"
      )}
    >
      {day &&
        segments.map((ring, i) => (
          <g
            className={cn(
              "transition-opacity duration-150 ease-out",
              focus !== null && focus !== i && "opacity-35"
            )}
            key={people[i]?.id ?? i}
          >
            <Ring
              count={people.length}
              index={i}
              lit={false}
              segments={ring}
              shift={day.shifts[i]}
            />
            <g clipPath={`url(#${clipId})`}>
              <Ring
                count={people.length}
                index={i}
                lit
                segments={ring}
                shift={day.shifts[i]}
              />
            </g>
          </g>
        ))}
    </g>
  );
}

function NowHand({ minutes }: { minutes: number }) {
  const [x0, y0] = polar(WEDGE_IN - 2, minutes);
  const [x1, y1] = polar(R_OUT + 14, minutes);
  return (
    <g className="pointer-events-none">
      <line
        className="stroke-orange-500"
        strokeLinecap="round"
        strokeWidth={1.5}
        x1={x0}
        x2={x1}
        y1={y0}
        y2={y1}
      />
      <circle className="fill-orange-500" cx={x1} cy={y1} r={2.5} />
    </g>
  );
}

function HoverHand({ minutes }: { minutes: number }) {
  const [x0, y0] = polar(WEDGE_IN, minutes);
  const [x1, y1] = polar(WEDGE_OUT, minutes);
  return (
    <line
      className="pointer-events-none stroke-zinc-900/30 dark:stroke-white/35"
      strokeWidth={1}
      x1={x0}
      x2={x1}
      y1={y0}
      y2={y1}
    />
  );
}

/** Which ring is theirs: the same circles as the dial, theirs drawn in. */
function RingGlyph({ index, count }: { index: number; count: number }) {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 16 16">
      {Array.from({ length: count }, (_, i) => {
        const r = 7 - (i * 4.5) / Math.max(1, count - 1);
        return (
          <circle
            className={
              i === index
                ? "stroke-zinc-900 dark:stroke-zinc-100"
                : "stroke-zinc-200 dark:stroke-zinc-700"
            }
            cx={8}
            cy={8}
            fill="none"
            key={r}
            r={r}
            strokeWidth={i === index ? 1.5 : 1}
          />
        );
      })}
    </svg>
  );
}

function PersonRow({
  person,
  index,
  count,
  status,
  range,
  shiftLabel: shift,
  dimmed,
  onHover,
}: {
  person: PlannerPerson;
  index: number;
  count: number;
  status?: Status;
  range: string;
  shiftLabel: string;
  dimmed: boolean;
  onHover: (index: number | null) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-black/5 border-b py-2 transition-opacity duration-150 ease-out last:border-b-0 dark:border-white/10",
        dimmed && "opacity-45"
      )}
      onPointerEnter={(event) =>
        event.pointerType === "mouse" && onHover(index)
      }
      onPointerLeave={() => onHover(null)}
      title={person.name}
    >
      <RingGlyph count={count} index={index} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-medium text-[13px] text-zinc-900 leading-5 dark:text-zinc-100">
            {person.city}
          </span>
          <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
            {index === 0 ? "You" : shift}
          </span>
        </span>
        <span className="truncate text-[11px] text-zinc-500 leading-4 dark:text-zinc-400">
          {person.name === "You" ? "Your clock" : person.name}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-[12px] text-zinc-700 leading-5 dark:text-zinc-200">
          {range ? <Rolling value={range} /> : " "}
        </span>
        <span
          className={cn(
            "text-[11px] leading-4 transition-colors duration-150",
            status ? STATUS_TEXT[status] : "text-zinc-400"
          )}
        >
          {status ? STATUS_LABEL[status] : " "}
        </span>
      </div>
      <span className="sr-only">
        {person.name}, {range} {status ? STATUS_LABEL[status] : ""}
      </span>
    </li>
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
