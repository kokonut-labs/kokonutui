"use client";

/**
 * @author: @dorianbaffier
 * @description: Photo Straighten
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RotateCcw, Wand2 } from "lucide-react";
import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX = 45;
// Ruler spacing: px per degree.
const PX = 9;
// A throw keeps going for this long, in seconds of its release speed.
const THROW = 0.18;
// Releases this close to level land on 0.
const SNAP = 0.6;
const SETTLE = { type: "spring", duration: 0.45, bounce: 0.1 } as const;
const TICKS = Array.from({ length: MAX * 2 + 1 }, (_, i) => i - MAX);

export interface PhotoStraightenProps {
  src?: string;
  alt?: string;
  /** Width over height of the crop. */
  aspectRatio?: number;
  /**
   * How crooked the photo is, in degrees; what Auto corrects. The demo
   * tilts its photo by this much so there is something to fix.
   */
  tilt?: number;
  defaultAngle?: number;
  onAngleChange?: (degrees: number) => void;
  className?: string;
}

const PHOTO =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&h=1200&fit=crop&auto=format&q=80";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Past the end of the ruler it still moves, with growing resistance.
function rubber(a: number) {
  if (Math.abs(a) <= MAX) {
    return a;
  }
  const over = Math.abs(a) - MAX;
  return Math.sign(a) * (MAX + 3 * (1 - Math.exp(-over / 6)));
}

const formatAngle = (a: number) => {
  const v = Math.round(a * 10) / 10;
  if (v === 0) {
    return "0°";
  }
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}°`;
};

export default function PhotoStraighten({
  src = PHOTO,
  alt = "A lake below mountains",
  aspectRatio = 4 / 3,
  tilt = 4.2,
  defaultAngle = 0,
  onAngleChange,
  className,
}: PhotoStraightenProps) {
  const reduce = useReducedMotion();
  const angle = useMotionValue(defaultAngle);
  const settle = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{
    x: number;
    from: number;
    samples: { x: number; t: number }[];
  } | null>(null);
  const [value, setValue] = useState(Math.round(defaultAngle * 10) / 10);
  const [adjusting, setAdjusting] = useState(false);

  // The photo turns by its own tilt plus the correction, and grows just
  // enough that no corner of the crop ever shows a gap.
  const ratio = Math.max(aspectRatio, 1 / aspectRatio);
  const transform = useTransform(angle, (a) => {
    const turn = tilt + a;
    const rad = (Math.abs(turn) * Math.PI) / 180;
    const scale = Math.cos(rad) + ratio * Math.sin(rad);
    return `rotate(${turn}deg) scale(${scale})`;
  });
  const rulerX = useTransform(angle, (a) => -(a + MAX) * PX);

  useMotionValueEvent(angle, "change", (a) => {
    const v = Math.round(clamp(a, -MAX, MAX) * 10) / 10;
    setValue((prev) => (prev === v ? prev : v));
    onAngleChange?.(v);
  });

  const settleTo = (to: number) => {
    settle.current?.stop();
    if (reduce) {
      angle.set(to);
      setAdjusting(false);
      return;
    }
    setAdjusting(true);
    settle.current = animate(angle, to, {
      ...SETTLE,
      onComplete: () => {
        if (!drag.current) {
          setAdjusting(false);
        }
      },
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    settle.current?.stop();
    drag.current = {
      x: event.clientX,
      from: angle.get(),
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
    setAdjusting(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    // Dragging the ruler left turns the photo clockwise, like a dial.
    angle.set(rubber(d.from - (event.clientX - d.x) / PX));
    d.samples.push({ x: event.clientX, t: event.timeStamp });
    if (d.samples.length > 5) {
      d.samples.shift();
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    drag.current = null;
    const first = d.samples[0];
    const dt = (event.timeStamp - first.t) / 1000;
    // Degrees per second at release, from the last few moves.
    const velocity =
      dt > 0 && dt < 0.15 ? -(event.clientX - first.x) / PX / dt : 0;
    let to = clamp(angle.get() + velocity * THROW, -MAX, MAX);
    if (Math.abs(to) < SNAP) {
      to = 0;
    } else {
      to = Math.round(to * 10) / 10;
    }
    settleTo(to);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : 0.1;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
    };
    if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      settleTo(0);
      return;
    }
    const move = moves[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    settle.current?.stop();
    angle.set(clamp(Math.round((angle.get() + move) * 10) / 10, -MAX, MAX));
  };

  const level = Math.abs(tilt + value) < 0.05;

  return (
    <div
      className={cn(
        "w-full max-w-lg select-none rounded-3xl border border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900"
        style={{ aspectRatio }}
      >
        <motion.div className="absolute inset-0" style={{ transform }}>
          <Image
            alt={alt}
            className="pointer-events-none object-cover"
            draggable={false}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            src={src}
            unoptimized
          />
        </motion.div>

        {/* A grid to line the horizon up against, only while adjusting. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out",
            adjusting ? "opacity-100" : "opacity-0"
          )}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              className={cn(
                "absolute inset-x-0 h-px",
                i % 2 === 0 ? "bg-white/70" : "bg-white/25"
              )}
              key={`h${i}`}
              style={{ top: `${(i / 6) * 100}%` }}
            />
          ))}
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              className={cn(
                "absolute inset-y-0 w-px",
                i % 2 === 0 ? "bg-white/70" : "bg-white/25"
              )}
              key={`v${i}`}
              style={{ left: `${(i / 6) * 100}%` }}
            />
          ))}
        </div>

        <span
          className={cn(
            "absolute top-3 left-3 rounded-full px-2.5 py-1 font-medium text-[11px] text-white transition-colors duration-200 ease-out",
            level ? "bg-emerald-600/90" : "bg-black/55"
          )}
        >
          {level ? "Level" : "Crooked"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <button
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs text-zinc-600 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          onClick={() => settleTo(-tilt)}
          type="button"
        >
          <Wand2 aria-hidden className="size-3.5" />
          Auto
        </button>
        <span className="font-medium text-sm tabular-nums">
          {formatAngle(value)}
        </span>
        <button
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs text-zinc-600 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          disabled={value === 0}
          onClick={() => settleTo(0)}
          type="button"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Reset
        </button>
      </div>

      {/* The ruler slides under a fixed centre mark. */}
      <div
        aria-label="Straighten"
        aria-valuemax={MAX}
        aria-valuemin={-MAX}
        aria-valuenow={value}
        aria-valuetext={formatAngle(value)}
        className="relative mt-2 h-12 cursor-ew-resize touch-none overflow-hidden rounded-lg outline-none [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] focus-visible:ring-2 focus-visible:ring-zinc-400"
        onDoubleClick={() => settleTo(0)}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        role="slider"
        tabIndex={0}
      >
        <motion.div
          className="absolute top-0 left-1/2 h-full"
          style={{ x: rulerX, width: MAX * 2 * PX }}
        >
          {TICKS.map((deg) => {
            const major = deg % 5 === 0;
            return (
              <span
                className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                key={deg}
                style={{ left: (deg + MAX) * PX }}
              >
                <span
                  className={cn(
                    "w-px",
                    major
                      ? "h-3 bg-zinc-400 dark:bg-zinc-500"
                      : "h-2 bg-zinc-300 dark:bg-zinc-700"
                  )}
                />
                {deg % 15 === 0 && (
                  <span className="mt-1 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
                    {deg}
                  </span>
                )}
              </span>
            );
          })}
        </motion.div>
        <span
          aria-hidden
          className="absolute top-1 left-1/2 h-5 w-0.5 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      </div>
    </div>
  );
}
