"use client";

/**
 * @author: @kokonutui
 * @description: Window Shade
 * @version: 1.0.0
 * @date: 2026-11-07
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SkyMoment {
  name: string;
  time: string;
  /** Top and bottom of the sky. */
  sky: [string, string];
  /** Where the sun or moon sits along its arc, 0 to 1. */
  arc: number;
  night?: boolean;
  /** How far down the shade goes when it follows the sun, 0 to 1. */
  shade: number;
}

export interface WindowShadeProps {
  room?: string;
  moments?: SkyMoment[];
  defaultShade?: number;
  /** Demo: ms per moment while following the sun. 0 turns it off. */
  followMs?: number;
  onChange?: (shade: number) => void;
  className?: string;
}

const DEMO_MOMENTS: SkyMoment[] = [
  {
    name: "Dawn",
    time: "06:40",
    sky: ["#7c6cf0", "#ffb38a"],
    arc: 0.12,
    shade: 0.55,
  },
  {
    name: "Day",
    time: "12:30",
    sky: ["#38a7f5", "#bfe7ff"],
    arc: 0.5,
    shade: 0.1,
  },
  {
    name: "Dusk",
    time: "19:10",
    sky: ["#5b3cc4", "#ff7a59"],
    arc: 0.88,
    shade: 0.7,
  },
  {
    name: "Night",
    time: "23:30",
    sky: ["#0b1026", "#2a2f6b"],
    arc: 0.4,
    night: true,
    shade: 1,
  },
];

const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const SPRING = { type: "spring", stiffness: 170, damping: 24 } as const;
const STARS = [
  [12, 18],
  [28, 9],
  [44, 22],
  [63, 12],
  [78, 26],
  [88, 8],
  [20, 34],
  [70, 38],
];

export default function WindowShade({
  room = "Bedroom",
  moments = DEMO_MOMENTS,
  defaultShade = 0.1,
  followMs = 3600,
  onChange,
  className,
}: WindowShadeProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-80px" });
  const [index, setIndex] = useState(1);
  const [follow, setFollow] = useState(followMs > 0);
  const [dragging, setDragging] = useState(false);
  const shade = useMotionValue(defaultShade);
  // Whole percent, so the text only re-renders when the number changes.
  const [shown, setShown] = useState(Math.round(defaultShade * 100));
  // The fabric slides down as one piece; a sliver always shows at the top.
  const shadeY = useTransform(
    shade,
    (v) => `${(Math.max(v, 0.04) - 1) * 100}%`
  );
  useMotionValueEvent(shade, "change", (v) => setShown(Math.round(v * 100)));

  const moment = moments[index];

  const setShade = (value: number, instant = false) => {
    const clamped = Math.min(1, Math.max(0, value));
    onChange?.(clamped);
    if (instant) {
      shade.jump(clamped);
    } else {
      animate(shade, clamped, SPRING);
    }
  };

  // Following the sun walks through the day and moves the shade with it.
  useEffect(() => {
    if (!(follow && inView)) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % moments.length;
        animate(shade, moments[next].shade, { ...SPRING, delay: 0.3 });
        return next;
      });
    }, followMs);
    return () => window.clearInterval(id);
  }, [follow, inView, followMs, moments, shade]);

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = paneRef.current?.getBoundingClientRect();
    if (box) {
      setShade((event.clientY - box.top) / box.height, true);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowDown: 0.1, ArrowUp: -0.1 };
    if (event.key in keys) {
      event.preventDefault();
      setFollow(false);
      setShade(shade.get() + keys[event.key]);
    }
  };

  // The sun and moon ride a low arc across the window.
  const bodyX = 8 + moment.arc * 84;
  const bodyY = 62 - Math.sin(moment.arc * Math.PI) * 42;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
        ref={rootRef}
      >
        <div
          aria-label={`${room} shade`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={shown}
          aria-valuetext={`${shown}% closed`}
          className={cn(
            "relative isolate h-72 touch-none select-none overflow-hidden rounded-[22px] outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/60",
            dragging ? "cursor-grabbing" : "cursor-ns-resize"
          )}
          onKeyDown={onKeyDown}
          onPointerCancel={() => setDragging(false)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            setFollow(false);
            fromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging) {
              fromPointer(event);
            }
          }}
          onPointerUp={() => setDragging(false)}
          ref={paneRef}
          role="slider"
          tabIndex={0}
        >
          {/* Each sky fades over the last. */}
          {moments.map((m, i) => (
            <motion.div
              animate={{ opacity: i === index ? 1 : 0 }}
              aria-hidden="true"
              className="absolute inset-0"
              initial={false}
              key={m.name}
              style={{
                background: `linear-gradient(180deg, ${m.sky[0]}, ${m.sky[1]})`,
              }}
              transition={{ duration: 0.8, ease: EASE_IN_OUT }}
            />
          ))}

          <motion.div
            animate={{ opacity: moment.night ? 1 : 0 }}
            aria-hidden="true"
            className="absolute inset-0"
            initial={false}
            transition={{ duration: 0.8, ease: EASE_IN_OUT }}
          >
            {STARS.map(([x, y], i) => (
              <span
                className="absolute size-[3px] rounded-full bg-white"
                key={`${x}-${y}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  opacity: 0.5 + (i % 3) * 0.25,
                }}
              />
            ))}
          </motion.div>

          {/* A full-size layer, so its x and y move the sun across the window. */}
          <motion.div
            animate={{ x: `${bodyX}%`, y: `${bodyY}%` }}
            aria-hidden="true"
            className="absolute inset-0"
            initial={false}
            transition={{ duration: 0.8, ease: EASE_IN_OUT }}
          >
            <div
              className="absolute top-0 left-0 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: moment.night
                  ? "radial-gradient(circle at 35% 35%, #ffffff, #cbd5ff)"
                  : "radial-gradient(circle at 35% 35%, #fff7e0, #ffb057)",
              }}
            />
          </motion.div>

          {/* Hills, tinted by the sky. */}
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/3 w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 40"
          >
            <defs>
              <linearGradient id={`${uid}-far`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#000" stopOpacity="0.25" />
                <stop offset="1" stopColor="#000" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id={`${uid}-near`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#000" stopOpacity="0.45" />
                <stop offset="1" stopColor="#000" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <path
              d="M0 18 C20 6 38 10 55 17 S85 12 100 9 V40 H0Z"
              fill={`url(#${uid}-far)`}
            />
            <path
              d="M0 30 C25 20 50 26 70 22 S92 20 100 24 V40 H0Z"
              fill={`url(#${uid}-near)`}
            />
          </svg>

          {/* The shade: pleated fabric that rolls down from the top. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 shadow-[0_6px_16px_rgba(0,0,0,0.16)]"
            style={{ y: shadeY }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(180deg, rgba(255,255,255,0.86) 0px, rgba(255,255,255,0.86) 10px, rgba(236,233,228,0.9) 12px, rgba(255,255,255,0.86) 14px), linear-gradient(180deg, transparent, rgba(0,0,0,0.06))",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-300">
              <span className="h-1 w-10 rounded-full bg-zinc-400/80" />
            </div>
          </motion.div>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 transition-colors duration-300",
              // Over the fabric the text turns dark so it stays readable.
              shown > 82 ? "text-zinc-800" : "text-white"
            )}
          >
            <div>
              <p className="text-[12px] opacity-85">
                {room} · {moment.time}
              </p>
              <p className="font-semibold text-[28px] tabular-nums leading-tight tracking-tight">
                {shown < 5 ? "Open" : `${shown}% closed`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 pt-3">
          {[
            { label: "Open", value: 0 },
            { label: "Half", value: 0.5 },
            { label: "Closed", value: 1 },
          ].map((preset) => (
            <button
              className="h-9 flex-1 rounded-2xl bg-zinc-100 text-[13px] text-zinc-700 outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              key={preset.label}
              onClick={() => {
                setFollow(false);
                setShade(preset.value);
              }}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <button
          aria-pressed={follow}
          className="mt-2 mb-1 flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-[13px] outline-hidden transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:bg-zinc-900"
          onClick={() => {
            const next = !follow;
            setFollow(next);
            if (next) {
              setShade(moment.shade);
            }
          }}
          type="button"
        >
          <span>
            Follow the sun
            <span className="block text-[11.5px] text-zinc-500 dark:text-zinc-400">
              Opens at dawn, closes after dusk
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-10 rounded-full transition-colors duration-200",
              follow
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-200 dark:bg-zinc-800"
            )}
          >
            <motion.span
              animate={{ x: follow ? 18 : 2 }}
              className={cn(
                "absolute top-0.5 left-0 size-5 rounded-full bg-white shadow-sm",
                follow ? "dark:bg-zinc-900" : "dark:bg-zinc-400"
              )}
              initial={false}
              transition={{ type: "spring", stiffness: 600, damping: 34 }}
            />
          </span>
        </button>
      </div>
    </MotionConfig>
  );
}
