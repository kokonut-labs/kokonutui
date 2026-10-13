"use client";

/**
 * @author: @dorianbaffier
 * @description: Elastic Slider
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Volume, Volume2 } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// How far (px) the track can stretch past either end, however far the
// pointer goes. The pull flattens out as it approaches this.
const MAX_OVERFLOW = 48;
const RELEASE_SPRING = { type: "spring", duration: 0.5, bounce: 0.35 } as const;

// Exponential damping: the first pixels past the edge stretch almost 1:1,
// the next ones less and less, so the track slows down instead of hitting a
// wall.
function damp(distance: number) {
  return MAX_OVERFLOW * (1 - Math.exp(-distance / MAX_OVERFLOW));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number, min: number, step: number) {
  const snapped = Math.round((value - min) / step) * step + min;
  // Avoid 0.30000000000000004 for decimal steps.
  return Number(snapped.toFixed(10));
}

export interface ElasticSliderProps {
  /** Accessible name, also shown above the track. */
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Initial value when uncontrolled. */
  defaultValue?: number;
  /** Controlled value. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** Formats the readout and `aria-valuetext`. */
  formatValue?: (value: number) => string;
  /** Icon at the low end. Pass `null` to hide it. */
  startIcon?: ReactNode;
  /** Icon at the high end. Pass `null` to hide it. */
  endIcon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function ElasticSlider({
  label = "Volume",
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  value: valueProp,
  onValueChange,
  formatValue = (v) => `${Math.round(v)}`,
  startIcon = <Volume aria-hidden="true" className="size-4" />,
  endIcon = <Volume2 aria-hidden="true" className="size-4" />,
  disabled = false,
  className,
}: ElasticSliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = clamp(valueProp ?? internalValue, min, max);
  const [dragging, setDragging] = useState(false);

  // Signed distance the track is stretched: negative past the start,
  // positive past the end. Driven straight from pointer moves, so dragging
  // never re-renders.
  const overflow = useMotionValue(0);
  const scaleX = useTransform(overflow, (o) => {
    const width = trackRef.current?.offsetWidth ?? 1;
    return 1 + Math.abs(o) / width;
  });
  // The track gets slightly thinner as it stretches, like a rubber band.
  const scaleY = useTransform(
    overflow,
    (o) => 1 - (Math.abs(o) / MAX_OVERFLOW) * 0.2
  );
  const transformOrigin = useTransform(overflow, (o) =>
    o < 0 ? "right center" : "left center"
  );
  // Each icon follows the end it sits next to.
  const startIconX = useTransform(overflow, (o) => Math.min(o, 0));
  const endIconX = useTransform(overflow, (o) => Math.max(o, 0));

  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const commit = (next: number) => {
    const snapped = clamp(snap(next, min, step), min, max);
    if (snapped === value) {
      return;
    }
    if (valueProp === undefined) {
      setInternalValue(snapped);
    }
    onValueChange?.(snapped);
  };

  const updateFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const { left, width } = track.getBoundingClientRect();
    const ratio = (clientX - left) / width;
    commit(min + clamp(ratio, 0, 1) * (max - min));

    if (reduceMotion) {
      return;
    }
    if (clientX < left) {
      overflow.jump(-damp(left - clientX));
    } else if (clientX > left + width) {
      overflow.jump(damp(clientX - (left + width)));
    } else {
      overflow.jump(0);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Ignore a second finger once a drag is under way, otherwise the value
    // jumps to wherever it lands.
    if (disabled || activePointer.current !== null) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    activePointer.current = event.pointerId;
    // Keep receiving moves after the pointer leaves the track, which is
    // exactly when the stretch happens.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) {
      return;
    }
    updateFromPointer(event.clientX);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) {
      return;
    }
    activePointer.current = null;
    setDragging(false);
    animate(overflow, 0, RELEASE_SPRING);
  };

  // Keyboard changes are instant: arrow keys get pressed many times in a
  // row, and an animation on each would make the slider feel behind.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const bigStep = Math.max(step, (max - min) / 10);
    const keySteps: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -bigStep,
      PageUp: bigStep,
    };
    if (event.key === "Home") {
      commit(min);
    } else if (event.key === "End") {
      commit(max);
    } else if (event.key in keySteps) {
      commit(value + keySteps[event.key]);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      className={cn(
        "w-full max-w-xs select-none",
        disabled && "opacity-50",
        className
      )}
    >
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span
          className="font-medium text-zinc-900 dark:text-zinc-100"
          id={labelId}
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "text-zinc-500 tabular-nums transition-colors duration-150 dark:text-zinc-400",
            dragging && "text-zinc-900 dark:text-zinc-100"
          )}
        >
          {formatValue(value)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
        {startIcon !== null && (
          <motion.span className="flex shrink-0" style={{ x: startIconX }}>
            {startIcon}
          </motion.span>
        )}

        {/* The hit area is taller than the visible track so it is easy to
            grab on touch screens. */}
        <div
          aria-disabled={disabled || undefined}
          aria-labelledby={labelId}
          aria-orientation="horizontal"
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={value}
          aria-valuetext={formatValue(value)}
          className={cn(
            "group/track relative flex h-8 flex-1 cursor-grab touch-none items-center rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
            dragging && "cursor-grabbing",
            disabled && "cursor-not-allowed"
          )}
          onKeyDown={handleKeyDown}
          onLostPointerCapture={release}
          onPointerCancel={release}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={release}
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
        >
          <motion.div
            className={cn(
              "relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 transition-[height] duration-150 ease-out dark:bg-zinc-800",
              "group-hover/track:h-2.5",
              dragging && "h-2.5"
            )}
            style={{ scaleX, scaleY, transformOrigin }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${percent}%` }}
            />
          </motion.div>
        </div>

        {endIcon !== null && (
          <motion.span className="flex shrink-0" style={{ x: endIconX }}>
            {endIcon}
          </motion.span>
        )}
      </div>
    </div>
  );
}
