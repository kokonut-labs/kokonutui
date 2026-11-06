"use client";

/**
 * @author: @kokonutui
 * @description: Thermostat
 * @version: 1.0.0
 * @date: 2026-11-06
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Droplets, Fan, Thermometer } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ThermostatProps {
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

const SIZE = 280;
const C = SIZE / 2;
const START = 135;
const SWEEP = 270;
const TICK_STEP = 0.2;
const STEP = 0.5;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const round = (n: number) => Math.round(n * 100) / 100;
const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: round(C + r * Math.cos(a)), y: round(C + r * Math.sin(a)) };
};
const tenths = (n: number) => Math.round(n * 10) / 10;

type Mode = "heat" | "cool" | "hold";

const MODE_TEXT: Record<Mode, string> = {
  heat: "Heating to",
  cool: "Cooling to",
  hold: "Holding at",
};

const MODE_TICK: Record<Mode, string> = {
  heat: "stroke-orange-500",
  cool: "stroke-sky-500",
  hold: "stroke-zinc-300 dark:stroke-zinc-700",
};

export default function Thermostat({
  room = "Living room",
  indoor = 19.4,
  defaultTarget = 22,
  min = 16,
  max = 28,
  humidity = 42,
  unit = "°C",
  driftMs = 700,
  onTargetChange,
  className,
}: ThermostatProps) {
  const [target, setTarget] = useState(defaultTarget);
  const [current, setCurrent] = useState(indoor);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const diff = tenths(target - current);
  let mode: Mode = "hold";
  if (diff > 0) {
    mode = "heat";
  } else if (diff < 0) {
    mode = "cool";
  }

  // The room follows the target a tenth of a degree at a time.
  useEffect(() => {
    if (mode === "hold") {
      return;
    }
    const id = window.setTimeout(() => {
      setCurrent((c) => tenths(c + (mode === "heat" ? 0.1 : -0.1)));
    }, driftMs);
    return () => window.clearTimeout(id);
  }, [mode, driftMs]);

  const toAngle = (t: number) => START + ((t - min) / (max - min)) * SWEEP;

  const commit = (next: number) => {
    const clamped = Math.min(
      max,
      Math.max(min, Math.round(next / STEP) * STEP)
    );
    if (clamped !== target) {
      setTarget(clamped);
      onTargetChange?.(clamped);
    }
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    // Measure from the start of the arc, so the gap sits at the bottom.
    let along = (deg - START + 720) % 360;
    if (along > SWEEP) {
      along = along - SWEEP < (360 - SWEEP) / 2 ? SWEEP : 0;
    }
    deg = along;
    commit(min + (deg / SWEEP) * (max - min));
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
    } else if (event.key === "Home") {
      event.preventDefault();
      commit(min);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(max);
    }
  };

  const ticks = Math.round((max - min) / TICK_STEP);
  const low = Math.min(current, target);
  const high = Math.max(current, target);
  const knob = toAngle(target);
  const here = toAngle(Math.min(max, Math.max(min, current)));

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 text-[13px]">
          <span className="font-medium">{room}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Auto</span>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[280px]">
          <div
            aria-label={`${room} target temperature`}
            aria-valuemax={max}
            aria-valuemin={min}
            aria-valuenow={target}
            aria-valuetext={`${target}${unit}, ${MODE_TEXT[mode].toLowerCase()} from ${current}${unit}`}
            className={cn(
              "h-full w-full touch-none select-none rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50",
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
            ref={svgRef}
            role="slider"
            tabIndex={0}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none block h-full w-full"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
              {Array.from({ length: ticks + 1 }, (_, i) => {
                const t = min + i * TICK_STEP;
                const deg = toAngle(t);
                const active =
                  mode !== "hold" && t >= low - 0.01 && t <= high + 0.01;
                // Steps away from the room temperature, for the flowing wave.
                const away = Math.round(Math.abs(t - current) / TICK_STEP);
                return (
                  <Tick
                    active={active}
                    away={away}
                    deg={deg}
                    key={t.toFixed(1)}
                    mode={mode}
                  />
                );
              })}

              {/* Where the room is now. */}
              <motion.circle
                animate={point(here, 92)}
                className="fill-zinc-400 dark:fill-zinc-500"
                initial={false}
                r={2.5}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />

              {/* The knob you turn. */}
              <motion.g
                animate={{ rotate: knob }}
                initial={false}
                style={{
                  transformBox: "view-box",
                  transformOrigin: `${C}px ${C}px`,
                }}
                transition={
                  dragging
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 32 }
                }
              >
                <line
                  className="stroke-zinc-900 dark:stroke-zinc-100"
                  strokeLinecap="round"
                  strokeWidth={3.5}
                  x1={C + 96}
                  x2={C + 128}
                  y1={C}
                  y2={C}
                />
              </motion.g>
            </svg>
          </div>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-[12px]",
                  mode === "heat" && "text-orange-600 dark:text-orange-400",
                  mode === "cool" && "text-sky-600 dark:text-sky-400",
                  mode === "hold" && "text-zinc-500 dark:text-zinc-400"
                )}
                exit={{ opacity: 0, y: -6 }}
                initial={{ opacity: 0, y: 6 }}
                key={mode}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {MODE_TEXT[mode]}
              </motion.span>
            </AnimatePresence>
            <span className="mt-1 flex items-start font-medium text-[56px] leading-none tracking-tight">
              <Rolling value={target.toFixed(1)} />
              <span className="mt-1.5 ml-0.5 font-normal text-[20px] text-zinc-400 dark:text-zinc-500">
                {unit}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 border-zinc-100 border-t text-[12px] dark:border-zinc-800/80">
          <Stat
            icon={<Thermometer aria-hidden="true" className="size-3.5" />}
            label="Indoor"
            value={`${current.toFixed(1)}°`}
          />
          <Stat
            icon={<Droplets aria-hidden="true" className="size-3.5" />}
            label="Humidity"
            value={`${humidity}%`}
          />
          <Stat
            icon={
              <motion.span
                animate={{ rotate: mode === "hold" ? 0 : 360 }}
                className="flex"
                transition={
                  mode === "hold"
                    ? { duration: 0.6, ease: EASE_OUT }
                    : {
                        duration: Math.max(0.5, 2.4 - Math.abs(diff) * 0.5),
                        ease: "linear",
                        repeat: Number.POSITIVE_INFINITY,
                      }
                }
              >
                <Fan aria-hidden="true" className="size-3.5" />
              </motion.span>
            }
            label="Fan"
            value={mode === "hold" ? "Idle" : "Running"}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

function Tick({
  deg,
  active,
  away,
  mode,
}: {
  deg: number;
  active: boolean;
  away: number;
  mode: Mode;
}) {
  const inner = point(deg, active ? 100 : 104);
  const outer = point(deg, active ? 122 : 116);
  if (!active) {
    return (
      <line
        className="stroke-zinc-200 dark:stroke-zinc-800"
        strokeLinecap="round"
        strokeWidth={1.5}
        x1={inner.x}
        x2={outer.x}
        y1={inner.y}
        y2={outer.y}
      />
    );
  }
  // Heat runs from the room temperature out to the target in waves.
  return (
    <motion.line
      animate={{ opacity: [0.35, 1, 0.35] }}
      className={MODE_TICK[mode]}
      initial={{ opacity: 0.35 }}
      strokeLinecap="round"
      strokeWidth={2}
      transition={{
        duration: 1.2,
        delay: away * 0.045,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 0.3,
      }}
      x1={inner.x}
      x2={outer.x}
      y1={inner.y}
      y2={outer.y}
    />
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 not-first:border-zinc-100 not-first:border-l px-4 py-3 dark:not-first:border-zinc-800/80">
      <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </span>
      <span className="font-medium text-[14px] tabular-nums">{value}</span>
    </div>
  );
}
