"use client";

/**
 * @author: @dorianbaffier
 * @description: Image Compare
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronsLeftRight } from "lucide-react";
import {
  type AnimationPlaybackControls,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// A press this close to the divider, in px, grabs it instead of gliding.
const GRAB = 28;
// How far past an edge the divider can be pulled, in percent.
const OVERDRAG = 4;
const GLIDE = { type: "spring", duration: 0.45, bounce: 0.12 } as const;

type View = "before" | "split" | "after";

export interface ImageCompareProps {
  beforeSrc?: string;
  afterSrc?: string;
  /** Extra classes for the before image, e.g. a filter when both sides share one photo. */
  beforeClassName?: string;
  afterClassName?: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
  /** Where the divider starts, 0 to 100 from the left. */
  defaultPosition?: number;
  /** Width over height. */
  aspectRatio?: number;
  onPositionChange?: (position: number) => void;
  className?: string;
}

const PHOTO =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&h=1067&fit=crop&auto=format&q=80";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Past an edge the divider keeps moving, slower and slower.
function rubber(p: number) {
  if (p < 0) {
    return -OVERDRAG * (1 - Math.exp(p / 25));
  }
  if (p > 100) {
    return 100 + OVERDRAG * (1 - Math.exp(-(p - 100) / 25));
  }
  return p;
}

function viewOf(p: number): View {
  if (p >= 99.5) {
    return "before";
  }
  if (p <= 0.5) {
    return "after";
  }
  return "split";
}

const VIEWS: { id: View; label: string; to: number }[] = [
  { id: "before", label: "Before", to: 100 },
  { id: "split", label: "Split", to: 50 },
  { id: "after", label: "After", to: 0 },
];

export default function ImageCompare({
  beforeSrc = PHOTO,
  afterSrc = PHOTO,
  beforeClassName = "saturate-[0.3] contrast-[0.86] brightness-[1.08]",
  afterClassName,
  beforeLabel = "Original",
  afterLabel = "Graded",
  alt = "A lake below mountains",
  defaultPosition = 50,
  aspectRatio = 3 / 2,
  onPositionChange,
  className,
}: ImageCompareProps) {
  const reduce = useReducedMotion();
  const pos = useMotionValue(defaultPosition);
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const glide = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ offset: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<View>(viewOf(defaultPosition));
  const [value, setValue] = useState(Math.round(defaultPosition));
  const pillId = useId();

  // The before image sits on top and is clipped to the left of the divider.
  const clip = useTransform(
    pos,
    (p) => `inset(0 ${100 - clamp(p, 0, 100)}% 0 0)`
  );
  const lineX = useTransform(pos, (p) => `${p}%`);
  // Each label steps aside as the divider comes over it.
  const beforeOpacity = useTransform(pos, [10, 24], [0, 1]);
  const afterOpacity = useTransform(pos, [76, 90], [1, 0]);

  useMotionValueEvent(pos, "change", (p) => {
    const next = viewOf(p);
    setView((v) => (v === next ? v : next));
    setValue(Math.round(clamp(p, 0, 100)));
    onPositionChange?.(clamp(p, 0, 100));
  });

  const moveTo = (to: number) => {
    glide.current?.stop();
    if (reduce) {
      pos.set(to);
      return;
    }
    glide.current = animate(pos, to, GLIDE);
  };

  const percentAt = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) {
      return pos.get();
    }
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) {
      return;
    }
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = percentAt(event.clientX);
    const dividerPx = (pos.get() / 100) * rect.width;
    const grabbed = Math.abs(event.clientX - rect.left - dividerPx) < GRAB;
    if (grabbed) {
      // Keep the grab point under the finger instead of snapping to it.
      glide.current?.stop();
      drag.current = { offset: pos.get() - at };
    } else {
      // A press elsewhere glides the divider there; moving takes over.
      moveTo(clamp(at, 0, 100));
      drag.current = { offset: 0 };
    }
    setDragging(true);
    handleRef.current?.focus({ preventScroll: true });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    if (glide.current && event.movementX !== 0) {
      glide.current.stop();
      glide.current = null;
    }
    if (!glide.current) {
      pos.set(rubber(percentAt(event.clientX) + drag.current.offset));
    }
  };

  const endDrag = () => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    setDragging(false);
    const p = pos.get();
    if (p < 0 || p > 100) {
      moveTo(clamp(p, 0, 100));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
    };
    const p = pos.get();
    let to: number | null = null;
    if (event.key === "Home") {
      to = 0;
    } else if (event.key === "End") {
      to = 100;
    } else if (moves[event.key] !== undefined) {
      to = clamp(Math.round(p + moves[event.key]), 0, 100);
    }
    if (to === null) {
      return;
    }
    event.preventDefault();
    if (event.key === "Home" || event.key === "End") {
      moveTo(to);
    } else {
      glide.current?.stop();
      pos.set(to);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-2xl select-none", className)}>
        <div
          className="relative cursor-ew-resize touch-pan-y overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900"
          onLostPointerCapture={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          ref={frameRef}
          style={{ aspectRatio }}
        >
          <Image
            alt={`${alt}, ${afterLabel.toLowerCase()}`}
            className={cn("pointer-events-none object-cover", afterClassName)}
            draggable={false}
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            src={afterSrc}
            unoptimized
          />
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{ clipPath: clip }}
          >
            <Image
              alt=""
              className={cn(
                "pointer-events-none object-cover",
                beforeClassName
              )}
              draggable={false}
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              src={beforeSrc}
              unoptimized
            />
          </motion.div>

          <motion.span
            className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-medium text-[11px] text-white"
            style={{ opacity: beforeOpacity }}
          >
            {beforeLabel}
          </motion.span>
          <motion.span
            className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 font-medium text-[11px] text-white"
            style={{ opacity: afterOpacity }}
          >
            {afterLabel}
          </motion.span>

          {/* A full-width layer moved by the position, so the divider never
              triggers layout. */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ x: lineX }}
          >
            <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" />
            <button
              aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
              aria-orientation="horizontal"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={value}
              aria-valuetext={`${value}% ${beforeLabel.toLowerCase()}`}
              className={cn(
                "pointer-events-auto absolute top-1/2 left-0 flex size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.2),0_0_0_1px_rgb(0_0_0/0.06)] outline-none transition-[box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
                dragging &&
                  "shadow-[0_4px_12px_rgb(0_0_0/0.25),0_0_0_4px_rgb(255_255_255/0.35)]"
              )}
              onKeyDown={handleKeyDown}
              ref={handleRef}
              role="slider"
              type="button"
            >
              <ChevronsLeftRight aria-hidden className="size-4" />
            </button>
          </motion.div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Drag or click to compare
          </p>
          <div className="flex rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
            {VIEWS.map((v) => (
              <button
                aria-pressed={view === v.id}
                className={cn(
                  "relative rounded-full px-3 py-1 font-medium text-xs outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                  view === v.id
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
                key={v.id}
                onClick={() => moveTo(v.to)}
                type="button"
              >
                {view === v.id && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:bg-zinc-800"
                    layoutId={pillId}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  />
                )}
                <span className="relative">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
