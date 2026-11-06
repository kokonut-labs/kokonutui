"use client";

/**
 * @author: @kokonutui
 * @description: Door Lock
 * @version: 1.0.0
 * @date: 2026-11-06
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { BatteryMedium, KeyRound, Lock, LockOpen, Timer } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LockEvent {
  id: string;
  text: string;
  time: string;
  kind: "lock" | "unlock" | "auto" | "code";
}

export interface DoorLockProps {
  door?: string;
  defaultLocked?: boolean;
  /** Seconds before an open door locks itself. */
  autoLockSeconds?: number;
  battery?: number;
  history?: LockEvent[];
  onLockChange?: (locked: boolean) => void;
  className?: string;
}

const DEMO_HISTORY: LockEvent[] = [
  { id: "h1", text: "Locked by Mara", time: "08:12", kind: "lock" },
  { id: "h2", text: "Leo used the keypad", time: "07:58", kind: "code" },
  { id: "h3", text: "Locked itself", time: "Yesterday", kind: "auto" },
];

const SIZE = 168;
const C = SIZE / 2;
const RING_R = 76;
const RING = 2 * Math.PI * RING_R;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const TURN = { type: "spring", stiffness: 260, damping: 18 } as const;

const ICONS: Record<LockEvent["kind"], ReactNode> = {
  lock: <Lock aria-hidden="true" className="size-3.5" />,
  unlock: <LockOpen aria-hidden="true" className="size-3.5" />,
  auto: <Timer aria-hidden="true" className="size-3.5" />,
  code: <KeyRound aria-hidden="true" className="size-3.5" />,
};

let counter = 0;
const nextId = () => {
  counter += 1;
  return `e${counter}`;
};

export default function DoorLock({
  door = "Front door",
  defaultLocked = true,
  autoLockSeconds = 15,
  battery = 82,
  history = DEMO_HISTORY,
  onLockChange,
  className,
}: DoorLockProps) {
  const [locked, setLocked] = useState(defaultLocked);
  const [events, setEvents] = useState(history);
  const [left, setLeft] = useState(autoLockSeconds);

  const change = (next: boolean, kind: LockEvent["kind"]) => {
    setLocked(next);
    onLockChange?.(next);
    const text = {
      lock: "Locked by you",
      unlock: "Unlocked by you",
      auto: "Locked itself",
      code: "Opened with a code",
    }[kind];
    setEvents((list) =>
      [{ id: nextId(), text, time: "Just now", kind }, ...list].slice(0, 4)
    );
  };

  const changeRef = useRef(change);
  changeRef.current = change;

  // An open door counts down and locks itself.
  useEffect(() => {
    if (locked) {
      setLeft(autoLockSeconds);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining =
        autoLockSeconds - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
        changeRef.current(true, "auto");
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [locked, autoLockSeconds]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 text-[13px]">
          <span className="font-medium">{door}</span>
          <span className="flex items-center gap-1.5 text-zinc-500 tabular-nums dark:text-zinc-400">
            <BatteryMedium aria-hidden="true" className="size-3.5" />
            {battery}%
          </span>
        </div>

        <div className="flex flex-col items-center pt-5 pb-4">
          <button
            aria-label={locked ? `Unlock ${door}` : `Lock ${door}`}
            aria-pressed={locked}
            className="group relative rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
            onClick={() => change(!locked, locked ? "unlock" : "lock")}
            style={{ width: SIZE, height: SIZE }}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 overflow-visible"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
              {/* The bolt shoots out past the rim when the door locks. */}
              <motion.rect
                animate={{ x: locked ? C + 52 : C + 24 }}
                className={cn(
                  "transition-colors duration-300",
                  locked
                    ? "fill-zinc-900 dark:fill-zinc-100"
                    : "fill-zinc-300 dark:fill-zinc-700"
                )}
                height={16}
                initial={false}
                rx={3}
                transition={{ ...TURN, delay: locked ? 0.08 : 0 }}
                width={44}
                y={C - 8}
              />
              {/* The strike in the door frame that the bolt slides into. */}
              <rect
                className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700"
                height={30}
                rx={4}
                width={12}
                x={C + RING_R + 18}
                y={C - 15}
              />
              <circle
                className="fill-white stroke-zinc-200 transition-colors duration-150 group-hover:fill-zinc-50 dark:fill-zinc-950 dark:stroke-zinc-800 dark:group-hover:fill-zinc-900"
                cx={C}
                cy={C}
                r={RING_R + 6}
                strokeWidth={1}
              />
              <circle
                className="fill-none stroke-zinc-100 dark:stroke-zinc-900"
                cx={C}
                cy={C}
                r={RING_R}
                strokeWidth={3}
              />
              {/* Time left before it locks itself. */}
              <motion.circle
                animate={{
                  strokeDashoffset: locked
                    ? RING
                    : RING * (1 - left / autoLockSeconds),
                }}
                className="fill-none stroke-orange-500"
                cx={C}
                cy={C}
                initial={false}
                r={RING_R}
                strokeDasharray={RING}
                strokeLinecap="round"
                strokeWidth={3}
                transform={`rotate(-90 ${C} ${C})`}
                transition={{ duration: locked ? 0.3 : 0.25, ease: "linear" }}
              />
              {/* The thumb turn: upright when open, across when locked. */}
              <motion.g
                animate={{ rotate: locked ? 90 : 0 }}
                initial={false}
                style={{
                  transformBox: "view-box",
                  transformOrigin: `${C}px ${C}px`,
                }}
                transition={TURN}
              >
                <rect
                  className={cn(
                    "transition-colors duration-300",
                    locked
                      ? "fill-zinc-900 dark:fill-zinc-100"
                      : "fill-zinc-200 dark:fill-zinc-800"
                  )}
                  height={86}
                  rx={11}
                  width={22}
                  x={C - 11}
                  y={C - 43}
                />
                <rect
                  className={cn(
                    "transition-colors duration-300",
                    locked
                      ? "fill-zinc-600 dark:fill-zinc-400"
                      : "fill-zinc-300 dark:fill-zinc-700"
                  )}
                  height={18}
                  rx={1.5}
                  width={3}
                  x={C - 1.5}
                  y={C - 33}
                />
              </motion.g>
            </svg>
          </button>

          <div className="relative mt-4 h-14 w-full overflow-hidden text-center">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
                key={locked ? "locked" : "open"}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <p
                  className={cn(
                    "font-medium text-[15px]",
                    !locked && "text-orange-600 dark:text-orange-400"
                  )}
                >
                  {locked ? "Locked" : "Unlocked"}
                </p>
                <p className="text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
                  {locked ? "Tap to unlock" : `Locks itself in ${left}s`}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <ul className="border-zinc-100 border-t px-2 py-2 dark:border-zinc-800/80">
          <AnimatePresence initial={false}>
            {events.slice(0, 3).map((event) => (
              <motion.li
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                key={event.id}
                layout
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                <div className="flex h-9 items-center gap-2.5 px-2 text-[12.5px]">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      event.kind === "unlock" || event.kind === "code"
                        ? "bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    )}
                  >
                    {ICONS[event.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{event.text}</span>
                  <span className="shrink-0 text-zinc-500 tabular-nums dark:text-zinc-400">
                    {event.time}
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </MotionConfig>
  );
}
