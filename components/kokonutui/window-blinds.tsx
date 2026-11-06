"use client";

/**
 * @author: @kokonutui
 * @description: Window Blinds
 * @version: 1.0.0
 * @date: 2026-11-06
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface BlindsState {
  /** How far down the blind is, 0 (up) to 1 (down). */
  position: number;
  /** How closed the slats are, 0 (open) to 1 (shut). */
  tilt: number;
}

export interface BlindsPreset extends BlindsState {
  name: string;
}

export interface WindowBlindsProps {
  room?: string;
  presets?: BlindsPreset[];
  defaultValue?: BlindsState;
  slats?: number;
  onChange?: (value: BlindsState) => void;
  className?: string;
}

const DEMO_PRESETS: BlindsPreset[] = [
  { name: "Open", position: 0, tilt: 0 },
  { name: "Filtered", position: 1, tilt: 0.35 },
  { name: "Privacy", position: 1, tilt: 0.75 },
  { name: "Closed", position: 1, tilt: 1 },
];

// The window on the wall and the floor in front of it, in SVG units.
const VIEW = { x: -42, w: 384, h: 300 };
const WIN = { x: 70, y: 26, w: 160, h: 140 };
const FLOOR_Y = 196;
const RAIL = 6;
const SPRING = { type: "spring", stiffness: 160, damping: 24 } as const;

const round = (n: number) => Math.round(n * 100) / 100;

/** Where a height on the window (0 top, 1 bottom) lands as sunlight on the floor. */
const onFloor = (v: number) => {
  const far = 1 - v;
  return {
    y: round(FLOOR_Y + 6 + far * 86),
    left: round(WIN.x + 18 + far * 54),
    right: round(WIN.x + WIN.w + 18 + far * 54),
  };
};

const patch = (v1: number, v2: number) => {
  const a = onFloor(v1);
  const b = onFloor(v2);
  return `M${a.left} ${a.y}H${a.right}L${b.right} ${b.y}H${b.left}Z`;
};

/** Each slat's top and height, as fractions of the window. */
const slatRows = (count: number, position: number, tilt: number) => {
  // Even when raised, the slats sit stacked under the head rail.
  const bottom = Math.max(position, 0.06);
  const pitch = bottom / count;
  const face = pitch * (0.16 + 0.84 * tilt);
  return {
    bottom,
    rows: Array.from({ length: count }, (_, i) => ({
      top: i * pitch,
      height: position < 0.08 ? pitch : face,
    })),
  };
};

/** Sunlight that gets through, from 0 to 100. */
const daylight = (position: number, tilt: number) =>
  Math.round((1 - position + position * (1 - (0.16 + 0.84 * tilt))) * 100);

export default function WindowBlinds({
  room = "Bedroom",
  presets = DEMO_PRESETS,
  defaultValue = { position: 1, tilt: 0.35 },
  slats = 14,
  onChange,
  className,
}: WindowBlindsProps) {
  const uid = useId();
  const position = useMotionValue(defaultValue.position);
  const tilt = useMotionValue(defaultValue.tilt);
  const [view, setView] = useState(defaultValue);
  const [target, setTarget] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(position, "change", (p) =>
    setView((v) => ({ ...v, position: p }))
  );
  useMotionValueEvent(tilt, "change", (t) =>
    setView((v) => ({ ...v, tilt: t }))
  );

  const go = (next: BlindsState, instant = false) => {
    const clamped = {
      position: Math.min(1, Math.max(0, next.position)),
      tilt: Math.min(1, Math.max(0, next.tilt)),
    };
    setTarget(clamped);
    onChange?.(clamped);
    if (instant) {
      position.jump(clamped.position);
      tilt.jump(clamped.tilt);
      return;
    }
    animate(position, clamped.position, SPRING);
    // Slats turn a beat after the blind starts to move.
    animate(tilt, clamped.tilt, { ...SPRING, delay: 0.12 });
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = windowRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    go(
      {
        position: (event.clientY - box.top) / box.height,
        tilt: target.tilt,
      },
      true
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowDown: 0.1, ArrowUp: -0.1 };
    if (event.key in keys) {
      event.preventDefault();
      go({ ...target, position: target.position + keys[event.key] });
    }
  };

  const { bottom, rows } = slatRows(slats, view.position, view.tilt);
  const light = daylight(view.position, view.tilt);
  const active = presets.find(
    (p) =>
      Math.abs(p.position - target.position) < 0.02 &&
      Math.abs(p.tilt - target.tilt) < 0.02
  );

  // Gaps between slats, then the open window below the blind.
  const lit: string[] = [];
  if (view.position > 0.08) {
    for (const [i, row] of rows.entries()) {
      const next = rows[i + 1]?.top ?? bottom;
      if (next - (row.top + row.height) > 0.002) {
        lit.push(patch(row.top + row.height, next));
      }
    }
  }
  const railBottom = bottom + RAIL / WIN.h;
  if (railBottom < 1) {
    lit.push(patch(railBottom, 1));
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 text-[13px]">
          <span className="font-medium">{room} blinds</span>
          <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
            Daylight {light}%
          </span>
        </div>

        <div className="relative mt-2 w-full">
          <svg
            aria-hidden="true"
            className="block h-auto w-full"
            viewBox={`${VIEW.x} 0 ${VIEW.w} ${VIEW.h}`}
          >
            <defs>
              <clipPath id={`${uid}-glass`}>
                <rect height={WIN.h} rx={3} width={WIN.w} x={WIN.x} y={WIN.y} />
              </clipPath>
            </defs>

            {/* Floor, and the sunlight that falls on it. */}

            <line
              className="stroke-zinc-200 dark:stroke-zinc-800"
              x1={VIEW.x}
              x2={VIEW.x + VIEW.w}
              y1={FLOOR_Y}
              y2={FLOOR_Y}
            />
            <path
              className="fill-orange-100 dark:fill-orange-300/15"
              d={lit.join("")}
            />

            {/* Outside. */}
            <g clipPath={`url(#${uid}-glass)`}>
              <rect
                className="fill-sky-100 dark:fill-sky-950"
                height={WIN.h}
                width={WIN.w}
                x={WIN.x}
                y={WIN.y}
              />
              <circle
                className="fill-orange-300 dark:fill-orange-300/80"
                cx={WIN.x + 112}
                cy={WIN.y + 44}
                r={15}
              />
              <path
                className="fill-emerald-200 dark:fill-emerald-900"
                d={`M${WIN.x} ${WIN.y + 112}C${WIN.x + 40} ${WIN.y + 86} ${WIN.x + 80} ${WIN.y + 92} ${WIN.x + 112} ${WIN.y + 108}S${WIN.x + 150} ${WIN.y + 96} ${WIN.x + WIN.w} ${WIN.y + 100}V${WIN.y + WIN.h}H${WIN.x}Z`}
              />
              <path
                className="fill-emerald-300 dark:fill-emerald-800"
                d={`M${WIN.x} ${WIN.y + 126}C${WIN.x + 50} ${WIN.y + 108} ${WIN.x + 100} ${WIN.y + 116} ${WIN.x + WIN.w} ${WIN.y + 124}V${WIN.y + WIN.h}H${WIN.x}Z`}
              />

              {rows.map((row, i) => (
                <rect
                  className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-600"
                  height={round(Math.max(row.height * WIN.h, 0.6))}
                  // biome-ignore lint/suspicious/noArrayIndexKey: slats are drawn by position
                  key={i}
                  strokeWidth={0.6}
                  width={WIN.w + 8}
                  x={WIN.x - 4}
                  y={round(WIN.y + row.top * WIN.h)}
                />
              ))}
              <rect
                className="fill-zinc-300 dark:fill-zinc-500"
                height={RAIL}
                rx={1}
                width={WIN.w + 8}
                x={WIN.x - 4}
                y={round(WIN.y + bottom * WIN.h)}
              />
            </g>

            <rect
              className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
              height={WIN.h + 8}
              rx={5}
              strokeWidth={4}
              width={WIN.w + 8}
              x={WIN.x - 4}
              y={WIN.y - 4}
            />
            <line
              className="stroke-zinc-300 dark:stroke-zinc-700"
              strokeWidth={3}
              x1={WIN.x + WIN.w / 2}
              x2={WIN.x + WIN.w / 2}
              y1={WIN.y}
              y2={WIN.y + WIN.h}
            />
            <rect
              className="fill-zinc-300 dark:fill-zinc-600"
              height={8}
              rx={2}
              width={WIN.w + 20}
              x={WIN.x - 10}
              y={WIN.y - 10}
            />
            <rect
              className="fill-zinc-200 dark:fill-zinc-800"
              height={6}
              rx={2}
              width={WIN.w + 20}
              x={WIN.x - 10}
              y={WIN.y + WIN.h + 2}
            />
          </svg>

          {/* The glass is the handle: drag down to lower the blind. */}
          <div
            aria-label={`${room} blind position`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(target.position * 100)}
            aria-valuetext={`${Math.round(target.position * 100)}% lowered`}
            className={cn(
              "absolute touch-none select-none rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/50",
              dragging ? "cursor-grabbing" : "cursor-ns-resize"
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
            ref={windowRef}
            role="slider"
            style={{
              left: `${((WIN.x - VIEW.x) / VIEW.w) * 100}%`,
              top: `${(WIN.y / VIEW.h) * 100}%`,
              width: `${(WIN.w / VIEW.w) * 100}%`,
              height: `${(WIN.h / VIEW.h) * 100}%`,
            }}
            tabIndex={0}
          />
        </div>

        <div className="flex items-center gap-3 px-4 pt-1">
          <span className="w-10 shrink-0 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            Tilt
          </span>
          <TiltSlider
            label={`${room} slat tilt`}
            onChange={(t) => go({ ...target, tilt: t }, true)}
            value={target.tilt}
          />
        </div>

        <div className="mt-4 flex gap-1 border-zinc-100 border-t p-2 dark:border-zinc-800/80">
          {presets.map((preset) => {
            const on = active?.name === preset.name;
            return (
              <button
                aria-pressed={on}
                className={cn(
                  "relative h-8 flex-1 rounded-md text-[12.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                  on
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
                key={preset.name}
                onClick={() => go(preset)}
                type="button"
              >
                {on && (
                  <motion.span
                    className="absolute inset-0 rounded-md bg-zinc-100 dark:bg-zinc-800"
                    layoutId={`${uid}-preset`}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}

function TiltSlider({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const fromPointer = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) {
      onChange(Math.min(1, Math.max(0, (clientX - box.left) / box.width)));
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: 0.05,
      ArrowUp: 0.05,
      ArrowLeft: -0.05,
      ArrowDown: -0.05,
    };
    if (event.key in keys) {
      event.preventDefault();
      onChange(Math.min(1, Math.max(0, value + keys[event.key])));
    }
  };
  // Ticks lean like slats: flat when open, upright when shut.
  const ticks = 24;
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}% closed`}
      className="relative flex h-8 flex-1 cursor-ew-resize touch-none select-none items-center justify-between rounded-md px-1 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50"
      onKeyDown={onKeyDown}
      onPointerCancel={() => setDragging(false)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        fromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) {
          fromPointer(event.clientX);
        }
      }}
      onPointerUp={() => setDragging(false)}
      ref={ref}
      role="slider"
      tabIndex={0}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const at = i / (ticks - 1);
        const passed = at <= value;
        return (
          <span
            className={cn(
              "h-4 w-[2px] rounded-full transition-[rotate,background-color] duration-300",
              passed
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-200 dark:bg-zinc-800"
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: ticks are drawn by position
            key={i}
            style={{ rotate: `${round(90 - value * 90)}deg` }}
          />
        );
      })}
    </div>
  );
}
