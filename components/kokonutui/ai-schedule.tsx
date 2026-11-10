"use client";

/**
 * @author: @kokonutui
 * @description: AI Schedule
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Globe, Video } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** A span of hours in the day, e.g. [9.5, 11] for 9:30 to 11:00. */
type Span = [number, number];

export interface ScheduleSlot {
  id: string;
  weekday: string;
  month: string;
  day: number;
  /** As shown, e.g. "10:00 – 10:30". */
  time: string;
  /** The slot itself, in hours. */
  at: Span;
  /** Your busy blocks that day. */
  you: Span[];
  /** Their busy blocks that day. */
  them: Span[];
  note?: string;
}

export interface SchedulePerson {
  name: string;
  initials: string;
}

export interface AIScheduleProps {
  prompt?: string;
  message?: string;
  title?: string;
  duration?: string;
  timezone?: string;
  with?: SchedulePerson;
  me?: SchedulePerson;
  slots?: ScheduleSlot[];
  /** Called when a slot is booked. Resolve once the invite is out. */
  onBook?: (slot: ScheduleSlot) => Promise<void>;
  className?: string;
}

type Status = "pick" | "booking" | "booked";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** The day strip runs from 8:00 to 18:00. */
const DAY_START = 8;
const DAY_HOURS = 10;

const DEMO_SLOTS: ScheduleSlot[] = [
  {
    id: "tue",
    weekday: "Tue",
    month: "Nov",
    day: 11,
    time: "10:00 – 10:30",
    at: [10, 10.5],
    you: [
      [8.5, 9.5],
      [13, 14.5],
    ],
    them: [
      [9, 10],
      [11, 12],
      [15, 16],
    ],
    note: "Before her 11:00",
  },
  {
    id: "wed",
    weekday: "Wed",
    month: "Nov",
    day: 12,
    time: "14:30 – 15:00",
    at: [14.5, 15],
    you: [
      [9, 11],
      [15.5, 17],
    ],
    them: [
      [10, 12.5],
      [13, 14.5],
    ],
  },
  {
    id: "thu",
    weekday: "Thu",
    month: "Nov",
    day: 13,
    time: "16:00 – 16:30",
    at: [16, 16.5],
    you: [
      [10, 12],
      [14, 16],
    ],
    them: [
      [8.5, 9.5],
      [12, 15.5],
    ],
    note: "End of day for both",
  },
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function AISchedule({
  prompt = "Find 30 minutes with Priya next week for the roadmap",
  message = "You’re both free at these times. Pick one and I’ll send the invite.",
  title = "Roadmap sync",
  duration = "30 min",
  timezone = "CET",
  with: guest = { name: "Priya Shah", initials: "PS" },
  me = { name: "You", initials: "M" },
  slots = DEMO_SLOTS,
  onBook = () => wait(900),
  className,
}: AIScheduleProps) {
  const name = useId();
  const [selected, setSelected] = useState(slots[0]?.id);
  const [status, setStatus] = useState<Status>("pick");
  const slot = slots.find((s) => s.id === selected) ?? slots[0];
  const first = guest.name.split(" ")[0];
  const visible = status === "booked" ? [slot] : slots;

  const book = async () => {
    setStatus("booking");
    try {
      await onBook(slot);
      setStatus("booked");
    } catch {
      setStatus("pick");
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {message}
        </p>

        <div className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <div className="flex h-8 items-center justify-between px-3 text-[12px] text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {duration}
              </span>{" "}
              with {guest.name}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Globe aria-hidden="true" className="size-3" />
              Your time · {timezone}
            </span>
          </div>

          <fieldset
            className="min-w-0 rounded-[18px] bg-white p-1 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]"
            disabled={status !== "pick"}
          >
            <legend className="sr-only">Pick a time</legend>
            <AnimatePresence initial={false}>
              {visible.map((s) => (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  key={s.id}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <SlotRow
                    booked={status === "booked"}
                    checked={s.id === selected}
                    guest={first}
                    name={name}
                    onSelect={() => setSelected(s.id)}
                    slot={s}
                    title={title}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </fieldset>

          <div className="flex h-12 items-center gap-3 pr-1.5 pl-3">
            <AnimatePresence initial={false} mode="popLayout">
              {status === "booked" ? (
                <motion.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-[12.5px] text-zinc-600 dark:text-zinc-300"
                  initial={{ opacity: 0, filter: "blur(3px)" }}
                  key="sent"
                  transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 }}
                >
                  <span className="flex gap-0.5">
                    <Avatar person={me} tone="you" />
                    <Avatar person={guest} tone="them" />
                  </span>
                  <span className="truncate">Invite sent to {first}</span>
                  <DrawnCheck />
                </motion.span>
              ) : (
                <motion.span
                  className="flex min-w-0 flex-1 items-center gap-3 text-[11.5px] text-zinc-500 dark:text-zinc-400"
                  exit={{ opacity: 0, filter: "blur(3px)" }}
                  key="legend"
                  transition={{ duration: 0.2 }}
                >
                  <Key className="bg-zinc-300 dark:bg-zinc-600" label="Busy" />
                  <Key className="bg-blue-500" label="Free for both" />
                </motion.span>
              )}
            </AnimatePresence>
            {status !== "booked" && (
              <BookButton
                busy={status === "booking"}
                label={`Book ${slot.weekday}`}
                onClick={book}
              />
            )}
          </div>
        </div>

        <AnimatePresence>
          {status === "booked" && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.45 }}
            >
              Booked for {slot.weekday} at {slot.time.split(" ")[0]}. {first}{" "}
              has the invite with a video link, and I put the roadmap doc in the
              notes.
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {status === "booking" ? "Booking" : ""}
          {status === "booked" ? `Booked, invite sent to ${first}` : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function SlotRow({
  slot,
  name,
  checked,
  booked,
  title,
  guest,
  onSelect,
}: {
  slot: ScheduleSlot;
  guest: string;
  name: string;
  checked: boolean;
  booked: boolean;
  title: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "relative block rounded-[14px] p-2.5 transition-colors duration-150 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-blue-500/40",
        booked ? "cursor-default" : "cursor-pointer",
        !booked && checked && "bg-zinc-100/80 dark:bg-white/[0.06]",
        !(booked || checked) && "hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
      )}
    >
      <span className="flex items-center gap-3">
        <input
          checked={checked}
          className="sr-only"
          name={name}
          onChange={onSelect}
          type="radio"
          value={slot.id}
        />
        <span className="flex w-10 shrink-0 flex-col overflow-hidden rounded-[9px] bg-white text-center ring-1 ring-black/[0.08] dark:bg-zinc-800 dark:ring-white/10">
          <span className="bg-red-500 py-px font-semibold text-[8.5px] text-white uppercase tracking-wider">
            {slot.month}
          </span>
          <span className="py-0.5 font-semibold text-[15px] text-zinc-900 leading-5 dark:text-zinc-100">
            {slot.day}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="block truncate font-medium text-[13.5px] text-zinc-900 dark:text-zinc-100"
              exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
              key={booked ? "title" : "time"}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {booked ? title : `${slot.weekday} · ${slot.time}`}
            </motion.span>
          </AnimatePresence>
          <span className="mt-0.5 block truncate text-[12px] text-zinc-500 dark:text-zinc-400">
            {booked
              ? `${slot.weekday} · ${slot.time}`
              : (slot.note ?? "Open for both")}
          </span>
        </span>

        <AnimatePresence initial={false} mode="popLayout">
          {booked ? (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 font-medium text-[11.5px] text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              initial={{ opacity: 0, x: 6 }}
              key="call"
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 }}
            >
              <Video aria-hidden="true" className="size-3" />
              Video call
            </motion.span>
          ) : (
            <motion.span
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-150",
                checked
                  ? "bg-zinc-900 ring-zinc-900 dark:bg-white dark:ring-white"
                  : "ring-zinc-300 dark:ring-zinc-600"
              )}
              exit={{ opacity: 0 }}
              key="radio"
              transition={{ duration: 0.15 }}
            >
              <motion.span
                animate={{ scale: checked ? 1 : 0.5, opacity: checked ? 1 : 0 }}
                className="size-1.5 rounded-full bg-white dark:bg-zinc-900"
                initial={false}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence initial={false}>
        {checked && !booked && (
          <motion.span
            animate={{ height: "auto", opacity: 1 }}
            className="block overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            <DayLanes guest={guest} slot={slot} />
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}

/** Both calendars for the day, so you can see why the slot is free. */
function DayLanes({ slot, guest }: { slot: ScheduleSlot; guest: string }) {
  const pct = (h: number) => `${((h - DAY_START) / DAY_HOURS) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / DAY_HOURS) * 100}%`;
  const lane = (label: string, spans: Span[]) => (
    <span className="flex h-3 items-center gap-2">
      <span className="w-10 shrink-0 truncate text-[10.5px] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <span className="relative h-1.5 flex-1 rounded-full bg-zinc-100 dark:bg-white/[0.06]">
        {spans.map(([a, b]) => (
          <span
            className="absolute inset-y-0 rounded-full bg-zinc-300 dark:bg-zinc-600"
            key={a}
            style={{ left: pct(a), width: width(a, b) }}
          />
        ))}
      </span>
    </span>
  );

  return (
    <span className="mt-2.5 ml-[52px] flex flex-col gap-1.5 pb-0.5">
      <span className="relative flex flex-col gap-1">
        {lane("You", slot.you)}
        {lane(guest, slot.them)}
        <span className="pointer-events-none absolute inset-y-0 right-0 left-12">
          <motion.span
            animate={{ opacity: 1, scaleY: 1 }}
            className="absolute -inset-y-0.5 min-w-1 rounded-[3px] bg-blue-500"
            initial={{ opacity: 0, scaleY: 0.4 }}
            style={{ left: pct(slot.at[0]), width: width(...slot.at) }}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 }}
          />
        </span>
      </span>
      <span className="relative ml-12 h-3 text-[10px] text-zinc-400 tabular-nums leading-3 dark:text-zinc-500">
        {[9, 12, 15].map((h) => (
          <span
            className="absolute top-0 -translate-x-1/2"
            key={h}
            style={{ left: pct(h) }}
          >
            {`${h}:00`}
          </span>
        ))}
      </span>
    </span>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("h-1 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function Avatar({
  person,
  tone,
}: {
  person: SchedulePerson;
  tone: "you" | "them";
}) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full font-semibold text-[9.5px]",
        tone === "you"
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
      )}
      title={person.name}
    >
      {person.initials}
    </span>
  );
}

function DrawnCheck() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
      fill="none"
      viewBox="0 0 16 16"
    >
      <motion.path
        animate={{ pathLength: 1, opacity: 1 }}
        d="M3.5 8.5l3 3 6-7"
        initial={{ pathLength: 0, opacity: 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.45 }}
      />
    </svg>
  );
}

function BookButton({
  busy,
  label,
  onClick,
}: {
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 min-w-[96px] items-center justify-center rounded-full bg-zinc-900 px-4 font-medium text-[13px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 active:bg-zinc-700 disabled:cursor-default dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          className="flex items-center"
          exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
          initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
          key={busy ? "busy" : label}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {busy ? <Spinner /> : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-4"
      fill="none"
      transition={{
        duration: 0.6,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.25"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </motion.svg>
  );
}
