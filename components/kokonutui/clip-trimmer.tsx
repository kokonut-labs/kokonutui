"use client";

/**
 * @author: @dorianbaffier
 * @description: Clip Trimmer
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const FRAMES = 10;
// Handles pull to whole seconds within this many px.
const SNAP_PX = 5;

type Part = "start" | "end" | "range" | "seek";

export interface ClipRange {
  start: number;
  end: number;
}

export interface ClipTrimmerProps {
  /**
   * A wide image the demo pans across to stand in for footage. Swap the
   * preview and filmstrip for your own video and frame grabs.
   */
  src?: string;
  alt?: string;
  /** Clip length in seconds. */
  duration?: number;
  defaultRange?: ClipRange;
  /** The shortest clip you can trim to, in seconds. */
  minLength?: number;
  onRangeChange?: (range: ClipRange) => void;
  className?: string;
}

const PANORAMA =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2400&h=800&fit=crop&auto=format&q=80";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const formatClock = (s: number) => {
  const tenths = Math.round(s * 10);
  const whole = Math.floor(tenths / 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${tenths % 10}`;
};

export default function ClipTrimmer({
  src = PANORAMA,
  alt = "A valley road at dusk",
  duration = 12,
  defaultRange = { start: 2.4, end: 9 },
  minLength = 1,
  onRangeChange,
  className,
}: ClipTrimmerProps) {
  const [range, setRange] = useState<ClipRange>(defaultRange);
  const [time, setTime] = useState(defaultRange.start);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<Part | null>(null);
  const [snapped, setSnapped] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef(range);
  const timeRef = useRef(time);
  const drag = useRef<{
    part: Part;
    x: number;
    from: ClipRange;
    moved: boolean;
  } | null>(null);

  rangeRef.current = range;

  useEffect(() => {
    onRangeChange?.(range);
  }, [range, onRangeChange]);

  // Playback loops inside the kept range.
  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { start, end } = rangeRef.current;
      let next = timeRef.current + (now - last) / 1000;
      last = now;
      if (next >= end || next < start) {
        next = start;
      }
      timeRef.current = next;
      setTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seek = (t: number) => {
    const next = clamp(t, rangeRef.current.start, rangeRef.current.end);
    timeRef.current = next;
    setTime(next);
  };

  const pxPerSecond = () =>
    (stripRef.current?.getBoundingClientRect().width ?? 1) / duration;

  const secondsAt = (clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
  };

  // A handle near a whole second pulls onto it, like a magnet.
  const snap = (t: number) => {
    const whole = Math.round(t);
    if (Math.abs(whole - t) * pxPerSecond() < SNAP_PX) {
      setSnapped(whole);
      return whole;
    }
    setSnapped(null);
    return t;
  };

  const moveHandle = (part: "start" | "end", t: number) => {
    const { start, end } = rangeRef.current;
    const next =
      part === "start"
        ? { start: clamp(snap(t), 0, end - minLength), end }
        : { start, end: clamp(snap(t), start + minLength, duration) };
    rangeRef.current = next;
    setRange(next);
    // The preview shows the frame you're cutting at.
    const at = part === "start" ? next.start : next.end;
    timeRef.current = at;
    setTime(at);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) {
      return;
    }
    const target = event.target as HTMLElement;
    const part = (target.closest("[data-part]")?.getAttribute("data-part") ??
      "seek") as Part;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { part, x: event.clientX, from: range, moved: false };
    setActive(part);
    if (part === "start" || part === "end") {
      setPlaying(false);
    } else if (part === "seek") {
      seek(secondsAt(event.clientX));
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    const dx = event.clientX - d.x;
    if (Math.abs(dx) > 3) {
      d.moved = true;
    }
    if (d.part === "start" || d.part === "end") {
      moveHandle(d.part, d.from[d.part] + dx / pxPerSecond());
    } else if (d.part === "range" && d.moved) {
      const length = d.from.end - d.from.start;
      const start = clamp(
        d.from.start + dx / pxPerSecond(),
        0,
        duration - length
      );
      const next = { start, end: start + length };
      rangeRef.current = next;
      setRange(next);
      seek(timeRef.current);
    } else if (d.part === "seek") {
      seek(secondsAt(event.clientX));
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    // A tap inside the kept range moves the playhead.
    if (d.part === "range" && !d.moved) {
      seek(secondsAt(event.clientX));
    }
    if (d.part === "start" || d.part === "end") {
      seek(rangeRef.current.start);
    }
    drag.current = null;
    setActive(null);
    setSnapped(null);
  };

  const handleKeyDown =
    (part: "start" | "end") => (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 1 : 0.1;
      const moves: Record<string, number> = {
        ArrowLeft: -step,
        ArrowDown: -step,
        ArrowRight: step,
        ArrowUp: step,
        Home: -duration,
        End: duration,
      };
      const move = moves[event.key];
      if (move === undefined) {
        return;
      }
      event.preventDefault();
      const { start, end } = rangeRef.current;
      const from = part === "start" ? start : end;
      const t = Math.round((from + move) * 10) / 10;
      const next =
        part === "start"
          ? { start: clamp(t, 0, end - minLength), end }
          : { start, end: clamp(t, start + minLength, duration) };
      rangeRef.current = next;
      setRange(next);
      seek(part === "start" ? next.start : next.end);
    };

  const togglePlay = () => {
    if (!playing && timeRef.current >= range.end - 0.05) {
      seek(range.start);
    }
    setPlaying((p) => !p);
  };

  const pct = (t: number) => (t / duration) * 100;
  const kept = range.end - range.start;
  const trimming = active === "start" || active === "end";
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i);
  // A longer, labelled tick every five seconds, like a tape ruler.
  const labelEvery = 5;

  return (
    <div
      className={cn(
        "w-full max-w-lg select-none rounded-3xl border border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        <Image
          alt={alt}
          className="pointer-events-none object-cover"
          draggable={false}
          fill
          sizes="(max-width: 512px) 100vw, 512px"
          src={src}
          style={{ objectPosition: `${pct(time)}% 50%` }}
          unoptimized
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-medium text-[11px] text-white tabular-nums">
          {formatClock(time)}
        </span>
        <button
          aria-label={playing ? "Pause" : "Play"}
          className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-full bg-black/55 text-white outline-none transition-colors duration-150 ease-out hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white"
          onClick={togglePlay}
          type="button"
        >
          {playing ? (
            <Pause aria-hidden className="size-3.5" fill="currentColor" />
          ) : (
            <Play
              aria-hidden
              className="size-3.5 translate-x-px"
              fill="currentColor"
            />
          )}
        </button>
      </div>

      <div className="mt-5 px-4">
        <div
          className="relative h-14 cursor-pointer touch-none"
          onLostPointerCapture={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          ref={stripRef}
        >
          {/* Filmstrip: one wide shot, cut into frames. */}
          <div className="absolute inset-0 flex overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
            {Array.from({ length: FRAMES }, (_, i) => (
              <div
                className="relative h-full flex-1 border-black/10 border-r last:border-r-0"
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed frame slots
                key={i}
              >
                <Image
                  alt=""
                  className="pointer-events-none object-cover"
                  draggable={false}
                  fill
                  sizes="64px"
                  src={src}
                  style={{
                    objectPosition: `${(i / (FRAMES - 1)) * 100}% 50%`,
                  }}
                  unoptimized
                />
              </div>
            ))}
          </div>

          {/* What gets cut is dimmed. Full-width layers moved by transform. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
            <div
              className="absolute inset-0 bg-white/75 dark:bg-zinc-950/75"
              style={{ transform: `translateX(${pct(range.start) - 100}%)` }}
            />
            <div
              className="absolute inset-0 bg-white/75 dark:bg-zinc-950/75"
              style={{ transform: `translateX(${pct(range.end)}%)` }}
            />
          </div>

          {/* Playhead */}
          <div
            className={cn(
              "pointer-events-none absolute -inset-y-1 left-0 w-full transition-opacity duration-150 ease-out",
              trimming ? "opacity-0" : "opacity-100"
            )}
            style={{ transform: `translateX(${pct(time)}%)` }}
          >
            <div className="relative h-full w-px -translate-x-1/2 bg-zinc-900 dark:bg-white">
              <span className="absolute -top-0.5 left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-white" />
            </div>
          </div>

          {/* Kept range: the frame, its two handles and the drag area. */}
          <div
            className={cn(
              "absolute inset-y-0 border-orange-600 border-y-[3px]",
              active === "range" ? "cursor-grabbing" : "cursor-grab"
            )}
            data-part="range"
            style={{
              left: `${pct(range.start)}%`,
              width: `${pct(kept)}%`,
            }}
          >
            {(["start", "end"] as const).map((part) => (
              <div
                aria-label={part === "start" ? "Trim start" : "Trim end"}
                aria-valuemax={duration}
                aria-valuemin={0}
                aria-valuenow={Math.round(range[part] * 10) / 10}
                aria-valuetext={`${range[part].toFixed(1)} seconds`}
                className={cn(
                  "group absolute -inset-y-[3px] flex w-4 cursor-ew-resize items-center justify-center bg-orange-600 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
                  part === "start"
                    ? "-left-4 rounded-l-lg"
                    : "-right-4 rounded-r-lg"
                )}
                data-part={part}
                key={part}
                onKeyDown={handleKeyDown(part)}
                role="slider"
                tabIndex={0}
              >
                <span
                  className={cn(
                    "h-5 w-[3px] rounded-full bg-white/60 transition-colors duration-150 ease-out",
                    active === part && "bg-white"
                  )}
                />
                {/* The exact cut point, while trimming. */}
                <span
                  className={cn(
                    "pointer-events-none absolute -top-8 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white tabular-nums transition-opacity duration-150 ease-out dark:bg-zinc-100 dark:text-zinc-900",
                    active === part ? "opacity-100" : "opacity-0"
                  )}
                >
                  {formatClock(range[part])}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ruler: whole seconds, the one a handle snapped to lights up. */}
        <div aria-hidden className="relative mt-2 h-5">
          {ticks.map((s) => (
            <span
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              key={s}
              style={{ left: `${pct(s)}%` }}
            >
              <span
                className={cn(
                  "w-px transition-colors duration-150 ease-out",
                  s % labelEvery === 0 ? "h-2" : "h-1",
                  snapped === s
                    ? "bg-orange-600"
                    : "bg-zinc-300 dark:bg-zinc-700"
                )}
              />
              {s % labelEvery === 0 && (
                <span
                  className={cn(
                    "mt-0.5 text-[10px] tabular-nums transition-colors duration-150 ease-out",
                    snapped === s
                      ? "text-orange-700 dark:text-orange-400"
                      : "text-zinc-400 dark:text-zinc-500"
                  )}
                >
                  {s}s
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-1 text-sm">
        <p className="text-zinc-500 tabular-nums dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {kept.toFixed(1)}s
          </span>{" "}
          of {duration.toFixed(1)}s
        </p>
        <button
          className="rounded-full px-3 py-1 text-xs text-zinc-500 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          disabled={range.start === 0 && range.end === duration}
          onClick={() => {
            const full = { start: 0, end: duration };
            rangeRef.current = full;
            setRange(full);
            seek(timeRef.current);
          }}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
