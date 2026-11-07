"use client";

/**
 * @author: @kokonutui
 * @description: Climate Dial
 * @version: 1.0.0
 * @date: 2026-11-07
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Droplets, Minus, Plus, Thermometer } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ClimateDialProps {
  room?: string;
  /** Temperature in the room when it first shows. */
  indoor?: number;
  defaultTarget?: number;
  min?: number;
  max?: number;
  humidity?: number;
  unit?: "°C" | "°F";
  /** Demo: ms for the room to move 0.1° toward the target. */
  driftMs?: number;
  onTargetChange?: (target: number) => void;
  className?: string;
}

const STEP = 0.5;
const SWEEP = 270;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Cold to hot, along the ring.
const STOPS = ["#38bdf8", "#818cf8", "#f472b6", "#fb923c"];

const tenths = (n: number) => Math.round(n * 10) / 10;

/** The ring's color at a point along it, 0 (cold) to 1 (hot). */
const colorAt = (t: number) => {
  const scaled = Math.min(0.999, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const channel = (hex: string, at: number) =>
    Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  const mix = (at: number) =>
    Math.round(channel(STOPS[i], at) * (1 - f) + channel(STOPS[i + 1], at) * f);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
};

type Mode = "heat" | "cool" | "hold";
const MODE_TEXT: Record<Mode, string> = {
  heat: "Heating to",
  cool: "Cooling to",
  hold: "Holding at",
};

export default function ClimateDial({
  room = "Living room",
  indoor = 19.4,
  defaultTarget = 22,
  min = 16,
  max = 28,
  humidity = 42,
  unit = "°C",
  driftMs = 650,
  onTargetChange,
  className,
}: ClimateDialProps) {
  const [target, setTarget] = useState(defaultTarget);
  const [current, setCurrent] = useState(indoor);
  const [dragging, setDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);

  const diff = tenths(target - current);
  let mode: Mode = "hold";
  if (diff > 0) {
    mode = "heat";
  } else if (diff < 0) {
    mode = "cool";
  }

  useEffect(() => {
    if (mode === "hold") {
      return;
    }
    const id = window.setTimeout(() => {
      setCurrent((c) => tenths(c + (mode === "heat" ? 0.1 : -0.1)));
    }, driftMs);
    return () => window.clearTimeout(id);
  }, [mode, driftMs]);

  const commit = (next: number) => {
    const value = Math.min(max, Math.max(min, Math.round(next / STEP) * STEP));
    if (value !== target) {
      setTarget(value);
      onTargetChange?.(value);
    }
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = dialRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    // Degrees clockwise from the start of the ring, at the bottom left.
    let along = ((Math.atan2(y, x) * 180) / Math.PI - 135 + 720) % 360;
    if (along > SWEEP) {
      along = along - SWEEP < (360 - SWEEP) / 2 ? SWEEP : 0;
    }
    commit(min + (along / SWEEP) * (max - min));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowUp: STEP,
      ArrowRight: STEP,
      ArrowDown: -STEP,
      ArrowLeft: -STEP,
    };
    if (event.key in keys) {
      event.preventDefault();
      commit(target + keys[event.key]);
    }
  };

  const fraction = (target - min) / (max - min);
  const here = (Math.min(max, Math.max(min, current)) - min) / (max - min);
  const tone = colorAt(fraction);
  const ring = `conic-gradient(from 225deg, ${STOPS.map((c, i) => `${c} ${(i / (STOPS.length - 1)) * SWEEP}deg`).join(", ")}, transparent ${SWEEP}deg)`;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative isolate w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-zinc-500 dark:text-zinc-400">{room}</span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full px-2.5 py-1 font-medium text-[12px] text-white"
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key={mode}
              style={{ background: mode === "hold" ? "#71717a" : tone }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {{ heat: "Heating", cool: "Cooling", hold: "Idle" }[mode]}
            </motion.span>
          </AnimatePresence>
        </div>

        <div
          aria-label={`${room} target temperature`}
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={target}
          aria-valuetext={`${target}${unit}`}
          className={cn(
            "relative mx-auto mt-4 aspect-square w-full max-w-[248px] touch-none select-none rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onKeyDown={onKeyDown}
          onPointerCancel={() => setDragging(false)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            fromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging) {
              fromPointer(event);
            }
          }}
          onPointerUp={() => setDragging(false)}
          ref={dialRef}
          role="slider"
          tabIndex={0}
        >
          {/* Warmth spills out behind the dial in the target's color. */}
          <div
            aria-hidden="true"
            className="absolute inset-6 -z-10 rounded-full opacity-50 blur-3xl transition-[background-color] duration-700"
            style={{ backgroundColor: tone }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-90"
            style={{
              background: ring,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 16px), #000 calc(100% - 15px))",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 16px), #000 calc(100% - 15px))",
            }}
          />

          {/* Where the room is now: a small notch on the ring. */}
          <motion.div
            animate={{ rotate: -135 + here * SWEEP }}
            aria-hidden="true"
            className="absolute inset-0"
            initial={false}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <span className="absolute top-[5px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/90" />
          </motion.div>

          <motion.div
            animate={{ rotate: -135 + fraction * SWEEP }}
            aria-hidden="true"
            className="absolute inset-0"
            initial={false}
            transition={
              dragging
                ? { duration: 0 }
                : { type: "spring", stiffness: 300, damping: 28 }
            }
          >
            <span className="absolute -top-[3px] left-1/2 size-[22px] -translate-x-1/2 rounded-full border-[3px] border-white bg-white shadow-[0_2px_10px_rgba(0,0,0,0.25)]" />
          </motion.div>

          <div
            className="absolute inset-[30px] overflow-hidden rounded-full transition-[background-color] duration-500"
            style={{ backgroundColor: tone }}
          >
            {/* Slow swirl, so the air looks like it moves. */}
            <motion.div
              animate={{ rotate: 360 }}
              aria-hidden="true"
              className="absolute -inset-1/4 opacity-60"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(255,255,255,0.45), transparent 30%, rgba(0,0,0,0.12) 55%, transparent 75%, rgba(255,255,255,0.45))",
              }}
              transition={{
                duration: mode === "hold" ? 30 : 9,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-[12px] opacity-85">{MODE_TEXT[mode]}</span>
              <span className="mt-0.5 flex items-start font-semibold text-[50px] leading-none tracking-tight">
                <Rolling value={target.toFixed(1)} />
                <span className="mt-1.5 ml-0.5 font-medium text-[18px] opacity-80">
                  {unit}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <StepButton label="Cooler" onClick={() => commit(target - STEP)}>
            <Minus aria-hidden="true" className="size-5" />
          </StepButton>
          <div className="flex flex-col items-center gap-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1 tabular-nums">
              <Thermometer aria-hidden="true" className="size-3.5" />
              Inside {current.toFixed(1)}°
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <Droplets aria-hidden="true" className="size-3.5" />
              Humidity {humidity}%
            </span>
          </div>
          <StepButton label="Warmer" onClick={() => commit(target + STEP)}>
            <Plus aria-hidden="true" className="size-5" />
          </StepButton>
        </div>
      </div>
    </MotionConfig>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/** Each digit rolls on its own, up when the value rises and down when it falls. */
function Rolling({ value }: { value: string }) {
  const previous = useRef(value);
  const up = Number(value) >= Number(previous.current);
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <span className="flex tabular-nums">
      {value.split("").map((char, i) => (
        <span
          className="relative inline-flex overflow-hidden"
          // biome-ignore lint/suspicious/noArrayIndexKey: each slot keeps its place
          key={i}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: up ? "-60%" : "60%", opacity: 0 }}
              initial={{ y: up ? "60%" : "-60%", opacity: 0 }}
              key={char}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
