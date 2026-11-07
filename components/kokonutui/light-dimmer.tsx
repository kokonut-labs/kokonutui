"use client";

/**
 * @author: @kokonutui
 * @description: Light Dimmer
 * @version: 1.0.0
 * @date: 2026-11-07
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Lightbulb } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LightColor {
  name: string;
  /** Bottom and top of the gradient. */
  from: string;
  to: string;
}

export interface LightDimmerProps {
  room?: string;
  colors?: LightColor[];
  defaultBrightness?: number;
  defaultColor?: string;
  onChange?: (value: {
    on: boolean;
    brightness: number;
    color: string;
  }) => void;
  className?: string;
}

const DEMO_COLORS: LightColor[] = [
  { name: "Warm", from: "#ff7a18", to: "#ffd29d" },
  { name: "Sunset", from: "#f5426c", to: "#ff9966" },
  { name: "Lagoon", from: "#0ea5e9", to: "#5eead4" },
  { name: "Orchid", from: "#7c3aed", to: "#f0abfc" },
  { name: "Forest", from: "#059669", to: "#bef264" },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function LightDimmer({
  room = "Living room",
  colors = DEMO_COLORS,
  defaultBrightness = 68,
  defaultColor = "Warm",
  onChange,
  className,
}: LightDimmerProps) {
  const [on, setOn] = useState(true);
  const [brightness, setBrightness] = useState(defaultBrightness);
  const [colorName, setColorName] = useState(defaultColor);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const level = useMotionValue(defaultBrightness);
  const [shown, setShown] = useState(defaultBrightness);
  const fillHeight = useTransform(level, (v) => `${v}%`);
  const wash = useTransform(level, (v) => (0.15 + (v / 100) * 0.85) * 0.45);
  const uid = useId();

  useMotionValueEvent(level, "change", (v) => setShown(Math.round(v)));

  const color = colors.find((c) => c.name === colorName) ?? colors[0];
  const target = on ? brightness : 0;

  useEffect(() => {
    if (dragging) {
      level.jump(target);
      return;
    }
    const controls = animate(level, target, { duration: 0.5, ease: EASE_OUT });
    return () => controls.stop();
  }, [target, dragging, level]);

  const report = (
    next: Partial<{ on: boolean; brightness: number; color: string }>
  ) => onChange?.({ on, brightness, color: colorName, ...next });

  const fromPointer = (clientY: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const value = Math.round(
      Math.min(1, Math.max(0, (box.bottom - clientY) / box.height)) * 100
    );
    setBrightness(Math.max(value, 1));
    setOn(value > 0);
    report({ brightness: value, on: value > 0 });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowUp: 5,
      ArrowRight: 5,
      ArrowDown: -5,
      ArrowLeft: -5,
    };
    if (event.key in keys) {
      event.preventDefault();
      const value = Math.min(100, Math.max(0, target + keys[event.key]));
      setBrightness(Math.max(value, 1));
      setOn(value > 0);
      report({ brightness: value, on: value > 0 });
    }
  };

  const gradient = `linear-gradient(to top, ${color.from}, ${color.to})`;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative isolate w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        {/* The room takes on the light's color. */}
        <motion.div
          aria-hidden="true"
          className="absolute -inset-x-10 -bottom-24 -z-10 h-64 rounded-full blur-3xl transition-[background] duration-700"
          style={{ background: gradient, opacity: wash }}
        />

        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              {room}
            </p>
            <p className="mt-1 flex items-baseline font-semibold text-[44px] tabular-nums leading-none tracking-tight">
              {on ? shown : "Off"}
              {on && (
                <span className="ml-0.5 font-medium text-[20px] text-zinc-400 dark:text-zinc-500">
                  %
                </span>
              )}
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                key={on ? color.name : "off"}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {on ? `${color.name} light` : "Swipe up to turn on"}
              </motion.p>
            </AnimatePresence>
          </div>
          <button
            aria-label={on ? `Turn off ${room} light` : `Turn on ${room} light`}
            aria-pressed={on}
            className={cn(
              "relative flex size-11 items-center justify-center rounded-full outline-hidden transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
              on
                ? "text-white"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
            )}
            onClick={() => {
              setOn(!on);
              report({ on: !on });
            }}
            style={on ? { background: gradient } : undefined}
            type="button"
          >
            {on && (
              <motion.span
                animate={{ opacity: [0.55, 0.2, 0.55], scale: [1, 1.35, 1] }}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full blur-md"
                style={{ background: gradient }}
                transition={{
                  duration: 2.6,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                }}
              />
            )}
            <Lightbulb aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-6 flex items-end gap-5">
          {/* The pill: swipe or tap anywhere on it to set the brightness. */}
          <div
            aria-label={`${room} brightness`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={target}
            aria-valuetext={on ? `${target}%` : "Off"}
            className={cn(
              "relative h-64 w-28 shrink-0 touch-none select-none overflow-hidden rounded-[32px] bg-zinc-100 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-900",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            onKeyDown={onKeyDown}
            onPointerCancel={() => setDragging(false)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              fromPointer(event.clientY);
            }}
            onPointerMove={(event) => {
              if (dragging) {
                fromPointer(event.clientY);
              }
            }}
            onPointerUp={() => setDragging(false)}
            ref={trackRef}
            role="slider"
            tabIndex={0}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0 overflow-hidden"
              style={{ height: fillHeight }}
            >
              <div
                className="absolute inset-x-0 bottom-0 h-64 transition-[background] duration-500"
                style={{ background: gradient }}
              />
              {/* Light drifting up inside the fill. */}
              <motion.div
                animate={{ y: ["40%", "-60%"] }}
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-64 opacity-40 mix-blend-soft-light"
                style={{
                  background:
                    "radial-gradient(60% 30% at 30% 50%, white, transparent 70%), radial-gradient(50% 25% at 75% 80%, white, transparent 70%)",
                }}
                transition={{
                  duration: 5,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                }}
              />
              <div className="absolute inset-x-0 top-2 flex justify-center">
                <span className="h-1 w-8 rounded-full bg-white/70" />
              </div>
            </motion.div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Color
            </p>
            <div className="grid grid-cols-5 gap-2">
              {colors.map((c) => {
                const selected = c.name === color.name;
                return (
                  <button
                    aria-label={c.name}
                    aria-pressed={selected}
                    className="relative flex aspect-square items-center justify-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                    key={c.name}
                    onClick={() => {
                      setColorName(c.name);
                      setOn(true);
                      report({ color: c.name, on: true });
                    }}
                    type="button"
                  >
                    {selected && (
                      <motion.span
                        className="absolute -inset-[3px] rounded-full border-2 border-zinc-900 dark:border-zinc-100"
                        layoutId={`${uid}-swatch`}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 34,
                        }}
                      />
                    )}
                    <span
                      className="size-full rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${c.to}, ${c.from})`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {[100, 50, 15].map((preset) => (
                <button
                  className={cn(
                    "flex h-9 items-center justify-between rounded-xl px-3 text-[13px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                    on && target === preset
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  )}
                  key={preset}
                  onClick={() => {
                    setBrightness(preset);
                    setOn(true);
                    report({ brightness: preset, on: true });
                  }}
                  type="button"
                >
                  <span>
                    {{ 100: "Bright", 50: "Relax", 15: "Night" }[preset]}
                  </span>
                  <span className="tabular-nums opacity-60">{preset}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
